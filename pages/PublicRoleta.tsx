
// FIX: Refactored component to use the prop-based API of RoletaWheel, resolving ref-related errors.
import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Prize, Company } from '../types';
import { RoletaWheel } from '../components/collaborator/RoletaWheel';
import { WinnerModal } from '../components/collaborator/WinnerModal';
import { Footer } from '../components/Footer';
import { supabase } from '../src/lib/supabaseClient';

// Helper to convert snake_case from DB to camelCase for the app
const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('_', ''));
const toCamel = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamel(v));
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => ({
      ...result,
      [snakeToCamel(key)]: toCamel(obj[key]),
    }), {});
  }
  return obj;
};

type Step = 'loading' | 'register' | 'verify_collaborator' | 'spin' | 'spun' | 'error' | 'already_participated';

const ConfettiExplosion: React.FC = React.memo(() => {
    const confettiCount = 100;
    const colors = ['#00D1FF', '#0052FF', '#FFFFFF', '#F59E0B', '#10B981'];

    return (
        <div className="confetti-container" aria-hidden="true">
            {Array.from({ length: confettiCount }).map((_, i) => (
                <div
                    key={i}
                    className="confetti-piece"
                    style={{
                        '--color': colors[i % colors.length],
                        '--x-start': `${Math.random() * 100}vw`,
                        '--x-end': `${Math.random() * 100}vw`,
                        '--y-end': `${Math.random() * 200 + 80}vh`,
                        '--delay': `${Math.random() * 2}s`,
                        '--duration': `${Math.random() * 3 + 4}s`,
                        '--rotation': `${Math.random() * 720 - 360}deg`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
});


export const PublicRoleta: React.FC = () => {
    const { companyId } = useParams<{ companyId: string }>();
    
    const [company, setCompany] = useState<Company | null>(null);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [step, setStep] = useState<Step>('loading');
    
    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
    const [collaboratorCode, setCollaboratorCode] = useState('');
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [participantId, setParticipantId] = useState<string | null>(null);
    
    const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
    const [winner, setWinner] = useState<Prize | null>(null);
    const [isSpinning, setIsSpinning] = useState(false);
    const [winningPrizeId, setWinningPrizeId] = useState<string | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const fetchPublicData = async () => {
            if (!companyId) {
                setStep('error');
                return;
            }

            const { data: companyData, error: companyError } = await supabase.from('companies').select('*').eq('id', companyId).single();
            if (companyError || !companyData) {
                console.error("Error fetching company:", companyError);
                setStep('error');
                return;
            }

            const companyDetails: Company = toCamel(companyData);
            setCompany(companyDetails);
            
            if (localStorage.getItem(`spun_roleta_${companyDetails.id}`) === 'true') {
                setStep('already_participated');
                return;
            }

            const { data: prizesData, error: prizesError } = await supabase.from('prizes').select('*').eq('company_id', companyId);
            if (prizesError) {
                console.error("Error fetching prizes:", prizesError);
            }

            setPrizes(toCamel(prizesData || []));
            setStep('register');
        };
        fetchPublicData();
    }, [companyId]);
    
     const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;

        setIsSubmitting(true);
        setFormError('');

        const trimmedEmail = formData.email.trim();
        const trimmedPhone = formData.phone.trim();

        if (trimmedEmail) { 
            const { data: existing } = await supabase
                .from('roleta_participants')
                .select('id')
                .eq('email', trimmedEmail.toLowerCase())
                .eq('company_id', company.id)
                .maybeSingle();
                
            if (existing) {
                setFormError('Este e-mail já participou da roleta deste estande.');
                setIsSubmitting(false);
                localStorage.setItem(`spun_roleta_${company.id}`, 'true');
                setStep('already_participated');
                return;
            }
        }

        const { data, error } = await supabase
            .from('roleta_participants')
            .insert({
                name: formData.name.trim(),
                email: trimmedEmail ? trimmedEmail.toLowerCase() : null,
                phone: trimmedPhone ? trimmedPhone : null,
                company_id: company.id,
            })
            .select()
            .single();

        setIsSubmitting(false);

        if (error || !data) {
            setFormError('Ocorreu um erro ao registrar. Tente novamente.');
            console.error('Registration Error:', error);
        } else {
            setParticipantId(data.id);
            setStep('verify_collaborator');
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const startSpin = () => {
        if (isSpinning || prizes.length < 2) return;

        const winnerIndex = Math.floor(Math.random() * prizes.length);
        const winnerData = prizes[winnerIndex];

        setWinner(winnerData);
        setWinningPrizeId(winnerData.id);
        setIsSpinning(true);

        const spinDurationMs = 5000;

        setTimeout(async () => {
            if (participantId) {
                await supabase
                    .from('roleta_participants')
                    .update({ prize_name: winnerData.name, spun_at: new Date().toISOString() })
                    .eq('id', participantId);
            }
            if (company) {
                 localStorage.setItem(`spun_roleta_${company.id}`, 'true');
            }
            setIsSpinning(false);
            setShowConfetti(true);
            setIsWinnerModalOpen(true);
            setTimeout(() => setShowConfetti(false), 7000); // Hide confetti after animation
            setStep('spun');
        }, spinDurationMs);
    };

    const handleVerifyCollaborator = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyId || !collaboratorCode) {
            setFormError('Por favor, insira o código do colaborador.');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        const { data, error } = await supabase
            .from('collaborators')
            .select('id')
            .eq('company_id', companyId)
            .eq('code', collaboratorCode.toUpperCase())
            .maybeSingle();

        setIsSubmitting(false);

        if (error || !data) {
            setFormError('Código do colaborador inválido.');
        } else {
            setStep('spin');
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 'loading':
                return <div className="roleta-panel-content"><p className="text-lg">Carregando roleta...</p></div>;
            case 'error':
                 return <div className="roleta-panel-content"><p className="text-xl font-bold text-red-400">Estande não encontrado.</p></div>;
            case 'already_participated':
                 return (
                    <div className="roleta-panel-content text-center">
                        <h2 className="text-2xl font-bold text-green-400">Obrigado por participar!</h2>
                        <p className="mt-2 text-gray-300">Você já girou a roleta deste estande. Boa sorte!</p>
                    </div>
                );
            case 'register':
                return (
                    <div className="roleta-panel-content">
                         <h2 className="text-2xl font-bold mb-1">Cadastre-se para Girar!</h2>
                         <p className="text-gray-400 mb-6">Preencha seus dados para concorrer.</p>
                         <form onSubmit={handleRegister} className="space-y-4 text-left">
                            <input type="text" name="name" placeholder="Nome Completo" onChange={handleChange} required className="input-style" />
                            <input type="email" name="email" placeholder="Seu E-mail (Opcional)" onChange={handleChange} className="input-style" />
                            <input type="tel" name="phone" placeholder="Seu WhatsApp (Opcional)" onChange={handleChange} className="input-style" />
                            {formError && <p className="text-sm text-red-400 text-center">{formError}</p>}
                            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">{isSubmitting ? 'Enviando...' : 'Avançar'}</button>
                         </form>
                    </div>
                );
            case 'verify_collaborator':
                 return (
                    <div className="roleta-panel-content">
                         <h2 className="text-2xl font-bold mb-1">Validação do Colaborador</h2>
                         <p className="text-gray-400 mb-6">Peça a um colaborador do estande para inserir o código pessoal dele para liberar a roleta.</p>
                         <form onSubmit={handleVerifyCollaborator} className="space-y-4 text-left">
                            <input 
                                type="text" 
                                name="collaboratorCode" 
                                placeholder="Código do Colaborador" 
                                value={collaboratorCode} 
                                onChange={(e) => setCollaboratorCode(e.target.value.toUpperCase())} 
                                required 
                                className="input-style uppercase text-center tracking-widest text-lg" 
                                autoFocus
                            />
                            {formError && <p className="text-sm text-red-400 text-center">{formError}</p>}
                            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                                {isSubmitting ? 'Verificando...' : 'Validar'}
                            </button>
                         </form>
                    </div>
                );
            case 'spin':
            case 'spun':
                 return (
                    <div className="roleta-panel-content text-center">
                        {isSpinning && <p className="text-xl font-bold animate-pulse text-dark-primary">Girando... Boa sorte!</p>}
                        
                        {!isSpinning && step === 'spin' && (
                            <>
                                <p className="text-2xl font-semibold mb-4">Tudo pronto, {formData.name.split(' ')[0]}!</p>
                                <button
                                    onClick={startSpin}
                                    disabled={prizes.length < 2}
                                    className="btn-primary btn-pulse w-full text-xl"
                                >
                                    Girar a Roleta!
                                </button>
                                {prizes.length < 2 && <p className="text-xs text-red-500 mt-2">A roleta está temporariamente indisponível.</p>}
                            </>
                        )}

                        {!isSpinning && step === 'spun' && (
                            <>
                                <p className="text-2xl font-bold text-green-400">Parabéns!</p>
                                <p className="text-gray-300">Você ganhou: <span className="font-bold text-white">{winner?.name}</span></p>
                                <p className="text-sm mt-4 text-gray-400">Mostre esta tela para um atendente e retire seu prêmio.</p>
                            </>
                        )}
                    </div>
                 );
        }
    }

    const showWheel = !['loading', 'error', 'already_participated'].includes(step);

    return (
        <div className="public-roleta-page">
            {showConfetti && <ConfettiExplosion />}
            <WinnerModal isOpen={isWinnerModalOpen} onClose={() => setIsWinnerModalOpen(false)} winner={winner} />

            <main className="roleta-main-content">
                <header className="roleta-header">
                    {company && (
                        <>
                            <img src={company.logoUrl || 'https://via.placeholder.com/80?text=Logo'} alt={company.name} className="roleta-logo" />
                            <h1 className="text-3xl lg:text-4xl font-bold text-white drop-shadow-lg">{company.name}</h1>
                        </>
                    )}
                </header>

                <div className="roleta-core-area">
                    <div className={`roleta-wheel-container ${!showWheel ? 'hidden' : ''}`}>
                         <RoletaWheel
                            prizes={prizes}
                            isSpinning={isSpinning}
                            winningPrizeId={winningPrizeId}
                            companyLogoUrl={company?.logoUrl}
                            segmentColorsOverride={company?.roletaColors}
                        />
                    </div>

                    <div className="roleta-interaction-panel">
                       {renderStepContent()}
                    </div>
                </div>
            </main>
            
            <div className="w-full mt-auto">
                 <Footer />
            </div>
            <style>{`
                :root {
                    --roleta-glow-color: rgba(0, 209, 255, 0.5);
                }
                .public-roleta-page {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background-color: #05080F;
                    background-image: radial-gradient(ellipse at center, #1e293b 0%, #05080F 80%);
                    color: #E0E0E0;
                    overflow: hidden;
                }
                .roleta-main-content {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    width: 100%;
                }
                .roleta-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .roleta-logo {
                    height: 80px;
                    width: 80px;
                    border-radius: 0.5rem;
                    object-fit: cover;
                    margin: 0 auto 1rem;
                    background-color: #10141F;
                    border: 2px solid rgba(255, 255, 255, 0.1);
                }
                .roleta-core-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2rem;
                    width: 100%;
                }
                @media (min-width: 1024px) {
                    .roleta-core-area {
                        flex-direction: row;
                        justify-content: center;
                        align-items: center;
                        gap: 4rem;
                    }
                }
                .roleta-wheel-container {
                    flex-shrink: 0;
                    width: 100%;
                    max-width: 320px;
                    filter: drop-shadow(0 0 20px var(--roleta-glow-color));
                }
                @media (min-width: 768px) {
                    .roleta-wheel-container {
                        max-width: 380px;
                    }
                }
                .roleta-interaction-panel {
                    width: 100%;
                    max-width: 420px;
                    background: rgba(16, 20, 31, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 1rem;
                    padding: 2rem;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                    min-height: 350px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .roleta-panel-content {
                    width: 100%;
                    text-align: center;
                }
                .input-style {
                    display: block; width: 100%; padding: 0.75rem 1rem;
                    background-color: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 0.5rem; color: #E0E0E0;
                    transition: border-color 0.3s, box-shadow 0.3s;
                }
                .input-style:focus {
                    outline: none;
                    border-color: var(--roleta-glow-color);
                    box-shadow: 0 0 10px var(--roleta-glow-color);
                }
                .btn-primary {
                    padding: 0.75rem 1rem; border-radius: 0.5rem; font-weight: 700; color: white;
                    background-image: linear-gradient(to right, #00D1FF, #0052FF);
                    border: none;
                    transition: all 0.3s ease;
                    box-shadow: 0 0 10px rgba(0, 209, 255, 0.4);
                }
                .btn-primary:hover:not(:disabled) {
                     transform: scale(1.05);
                     box-shadow: 0 0 20px rgba(0, 209, 255, 0.7);
                }
                .btn-primary:active:not(:disabled) { transform: scale(0.98); }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-pulse { animation: pulse-glow 2s infinite; }
                @keyframes pulse-glow {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 10px rgba(0, 209, 255, 0.4); }
                    50% { transform: scale(1.05); box-shadow: 0 0 25px rgba(0, 209, 255, 0.8); }
                }

                /* Confetti Styles */
                .confetti-container {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    pointer-events: none;
                    z-index: 9999;
                }
                .confetti-piece {
                    position: absolute;
                    width: 10px;
                    height: 20px;
                    background: var(--color);
                    top: -20px;
                    left: var(--x-start);
                    animation: fall var(--duration) var(--delay) linear infinite;
                }
                @keyframes fall {
                    to {
                        transform: translateY(var(--y-end)) rotate(var(--rotation));
                        opacity: 0;
                    }
                }
          `}</style>
        </div>
    );
};
