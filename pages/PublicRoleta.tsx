
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

        if (trimmedEmail) { // Only check for existing email if provided
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
            setIsWinnerModalOpen(true);
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

    const renderContent = () => {
        switch (step) {
            case 'loading':
                return <p className="text-lg">Carregando roleta...</p>;
            case 'error':
                 return <p className="text-xl font-bold text-red-400">Estande não encontrado.</p>;
            case 'already_participated':
                 return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-green-400">Obrigado por participar!</h2>
                        <p className="mt-2">Você já girou a roleta deste estande. Boa sorte!</p>
                    </div>
                );
            case 'register':
                return (
                    <div className="w-full max-w-sm">
                         <h2 className="text-2xl font-bold mb-1">Cadastre-se para Girar!</h2>
                         <p className="text-gray-400 mb-6">Preencha seus dados para concorrer.</p>
                         <form onSubmit={handleRegister} className="space-y-4 text-left">
                            <input type="text" name="name" placeholder="Nome Completo" onChange={handleChange} required className="input-style" />
                            <input type="email" name="email" placeholder="Seu E-mail (Opcional)" onChange={handleChange} className="input-style" />
                            <input type="tel" name="phone" placeholder="Seu WhatsApp (Opcional)" onChange={handleChange} className="input-style" />
                            {formError && <p className="text-sm text-red-400 text-center">{formError}</p>}
                            <button type="submit" disabled={isSubmitting} className="w-full py-3 px-4 font-bold text-white bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">{isSubmitting ? 'Enviando...' : 'Avançar'}</button>
                         </form>
                    </div>
                );
            case 'verify_collaborator':
                 return (
                    <div className="w-full max-w-sm">
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
                                className="input-style uppercase" 
                                autoFocus
                            />
                            {formError && <p className="text-sm text-red-400 text-center">{formError}</p>}
                            <button type="submit" disabled={isSubmitting} className="w-full py-3 px-4 font-bold text-white bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                                {isSubmitting ? 'Verificando...' : 'Validar'}
                            </button>
                         </form>
                    </div>
                );
            case 'spin':
            case 'spun':
                 return (
                     <>
                        <RoletaWheel
                            prizes={prizes}
                            isSpinning={isSpinning}
                            winningPrizeId={winningPrizeId}
                            companyLogoUrl={company?.logoUrl}
                            segmentColorsOverride={company?.roletaColors}
                        />
                        {step === 'spin' && !isSpinning && (
                            <div className="mt-8 text-center w-full max-w-sm">
                                <p className="text-lg font-semibold mb-4">Tudo pronto! Boa sorte!</p>
                                <button
                                    onClick={startSpin}
                                    disabled={isSpinning || prizes.length < 2}
                                    className="w-full py-4 text-xl font-bold text-white bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 animate-pulse disabled:animate-none"
                                >
                                    Girar a Roleta!
                                </button>
                            </div>
                        )}
                         {isSpinning && (
                            <p className="mt-8 text-xl font-bold animate-pulse text-light-primary dark:text-dark-primary">Girando... Boa sorte!</p>
                        )}
                        {step === 'spun' && !isSpinning && (
                            <div className="mt-8 text-center">
                                <p className="text-xl font-bold text-green-400">Prêmio definido!</p>
                                <p className="text-gray-400">Obrigado por participar.</p>
                            </div>
                        )}
                        {prizes.length < 2 && <p className="text-xs text-red-500 mt-2">A roleta está temporariamente indisponível.</p>}
                     </>
                 );
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text">
            <WinnerModal isOpen={isWinnerModalOpen} onClose={() => setIsWinnerModalOpen(false)} winner={winner} />
            <header className="py-4">
                <div className="container mx-auto flex flex-col items-center text-center">
                    <img src={company?.logoUrl || 'https://via.placeholder.com/80?text=Logo'} alt={company?.name} className="h-20 w-20 rounded-md object-cover mb-2" />
                    <h1 className="text-3xl font-bold">{company?.name}</h1>
                </div>
            </header>

            <main className="flex-grow flex flex-col items-center justify-center p-4">
               {renderContent()}
            </main>
            
            <div className="w-full mt-auto">
                 <Footer />
            </div>
            <style>{`
            .input-style {
                display: block; width: 100%; padding: 0.75rem; background-color: #05080F;
                border: 1px solid #1A202C; border-radius: 0.375rem; color: #E0E0E0;
            }
            .dark .input-style { background-color: #10141F; border-color: #1A202C; }
            .light .input-style { background-color: #F9FAFB; border-color: #E5E7EB; color: #1F2937 }

            .btn-secondary {
                 padding: 0.75rem 1rem; border-radius: 0.375rem; font-weight: 600; color: #E0E0E0;
                background-color: #1A202C; transition: background-color 0.2s;
            }
            .btn-secondary:hover { background-color: #2d2d2d; }
          `}</style>
        </div>
    );
};
