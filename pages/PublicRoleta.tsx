// FIX: Replaced corrupted file content with a functional PublicRoleta component.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Prize, Company } from '../types';
import { RoletaWheel } from '../components/collaborator/RoletaWheel';
import { WinnerModal } from '../components/collaborator/WinnerModal';
import { Footer } from '../components/Footer';
import { supabase } from '../src/lib/supabaseClient';
import { Triad3Logo } from '../components/Triad3Logo';

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

type Step = 'loading' | 'register' | 'spin' | 'spun' | 'error' | 'already_participated';

export const PublicRoleta: React.FC = () => {
    const { companyId } = useParams<{ companyId: string }>();
    const [step, setStep] = useState<Step>('loading');
    const [company, setCompany] = useState<Company | null>(null);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
    const [participantId, setParticipantId] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    
    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState<Prize | null>(null);
    const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
    const [winningPrizeId, setWinningPrizeId] = useState<string | null>(null);

    useEffect(() => {
        if (!companyId) {
            setStep('error');
            setMessage('ID da empresa não encontrado na URL.');
            return;
        }
        const fetchData = async () => {
            setLoading(true);
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (companyError || !companyData) {
                setStep('error');
                setMessage('Estande não encontrado ou inválido.');
                setLoading(false);
                return;
            }
            setCompany(toCamel(companyData) as Company);

            const { data: prizeData, error: prizeError } = await supabase
              .from('prizes')
              .select('*')
              .eq('company_id', companyId);
            
            if (prizeError || !prizeData || prizeData.length < 2) {
                setStep('error');
                setMessage('Não há prêmios suficientes cadastrados para esta roleta.');
                setLoading(false);
                return;
            }
            setPrizes(toCamel(prizeData) as Prize[]);
            setStep('register');
            setLoading(false);
        };
        fetchData();
    }, [companyId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;
        setLoading(true);
        setMessage('');

        const lowerCaseEmail = formData.email.toLowerCase();

        const { data: existingParticipant } = await supabase
            .from('roleta_participants')
            .select('id, spun_at')
            .eq('company_id', company.id)
            .eq('email', lowerCaseEmail)
            .maybeSingle();

        if (existingParticipant) {
             if (existingParticipant.spun_at) {
                setStep('already_participated');
             } else {
                 setParticipantId(existingParticipant.id);
                 setStep('spin');
             }
             setLoading(false);
             return;
        }

        const { data: newParticipant, error: insertError } = await supabase
            .from('roleta_participants')
            .insert({
                company_id: company.id,
                name: formData.name,
                phone: formData.phone,
                email: lowerCaseEmail,
            })
            .select('id')
            .single();
        
        setLoading(false);
        if (insertError || !newParticipant) {
            setStep('error');
            setMessage(`Ocorreu um erro ao se registrar: ${insertError.message}`);
        } else {
            setParticipantId(newParticipant.id);
            setStep('spin');
        }
    };
    
    const handleSpin = () => {
        if (isSpinning || prizes.length < 2 || !participantId) return;

        const winnerIndex = Math.floor(Math.random() * prizes.length);
        const winnerData = prizes[winnerIndex];
        
        setWinner(winnerData);
        setWinningPrizeId(winnerData.id);
        setIsSpinning(true);
        
        const spinDurationMs = 5000;

        setTimeout(async () => {
            setIsSpinning(false);
            setIsWinnerModalOpen(true);
            setStep('spun');
            
            await supabase
                .from('roleta_participants')
                .update({ prize_name: winnerData.name, spun_at: new Date().toISOString() })
                .eq('id', participantId);

        }, spinDurationMs);
    };

    const renderContent = () => {
        switch (step) {
            case 'loading':
                return <p className="text-gray-400">Carregando...</p>;
            case 'error':
                return <p className="text-red-400">{message}</p>;
            case 'already_participated':
                return (
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-yellow-400 mb-2">Atenção!</h1>
                        <p className="text-gray-300 mb-6">Você já participou da roleta neste estande. Agradecemos sua participação!</p>
                    </div>
                );
            case 'spun':
                 return (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-4">Obrigado por participar!</h2>
                        <p className="text-gray-500 dark:text-gray-400">Seu prêmio foi: <span className="font-bold text-dark-primary">{winner?.name}</span></p>
                        <RoletaWheel prizes={prizes} isSpinning={false} winningPrizeId={winningPrizeId} companyLogoUrl={company?.logoUrl} segmentColorsOverride={company?.roletaColors} />
                    </div>
                );
            case 'spin':
                return (
                     <div className="text-center">
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-4">Boa sorte, {formData.name.split(' ')[0]}!</h2>
                        <RoletaWheel prizes={prizes} isSpinning={isSpinning} winningPrizeId={winningPrizeId} companyLogoUrl={company?.logoUrl} segmentColorsOverride={company?.roletaColors} />
                        <button onClick={handleSpin} disabled={isSpinning || prizes.length < 2} className="mt-6 px-12 py-4 text-xl font-bold text-white bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary rounded-lg shadow-lg hover:scale-105 active:scale-100 transition-all duration-300 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed disabled:transform-none animate-pulse disabled:animate-none">
                            {isSpinning ? 'Girando...' : 'Girar Roleta'}
                        </button>
                     </div>
                );
            case 'register':
                if (!company) return null;
                return (
                    <>
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-dark-primary to-dark-secondary mb-2">Gire e Ganhe!</h1>
                        <p className="text-gray-400 mb-6">Faça seu cadastro para girar a roleta de prêmios de <span className="font-bold text-dark-text">{company.name}</span>.</p>
                        <form onSubmit={handleRegister} className="space-y-4 text-left">
                            <input type="text" name="name" placeholder="Nome completo" value={formData.name} onChange={handleChange} required className="input-style" />
                            <input type="email" name="email" placeholder="Seu melhor e-mail" value={formData.email} onChange={handleChange} required className="input-style" />
                            <input type="tel" name="phone" placeholder="Telefone (WhatsApp)" value={formData.phone} onChange={handleChange} required className="input-style" />
                            <button type="submit" disabled={loading} className="w-full btn-primary">
                                {loading ? 'Cadastrando...' : 'Quero Girar!'}
                            </button>
                        </form>
                    </>
                );
        }
    };

    return (
        <div className="flex flex-col items-center justify-between min-h-screen bg-light-background dark:bg-dark-background px-4 dark">
            <WinnerModal isOpen={isWinnerModalOpen} onClose={() => setIsWinnerModalOpen(false)} winner={winner} />
            <div className="w-full max-w-md py-8">
                <div className="bg-light-card dark:bg-dark-card p-6 rounded-lg shadow-xl text-center">
                    {company?.logoUrl ?
                        <img src={company.logoUrl} alt={`${company.name} logo`} className="w-32 h-32 object-contain mx-auto mb-6 rounded-md" />
                        : <Triad3Logo className="w-32 mx-auto mb-6" />
                    }
                    {renderContent()}
                </div>
            </div>
            <Footer />
            <style>{`
              .input-style { display: block; width: 100%; padding: 0.75rem; background-color: #05080F; border: 1px solid #1A202C; border-radius: 0.375rem; color: #E0E0E0; }
              .input-style:focus { outline: none; border-color: #00D1FF; }
              .btn-primary { padding: 0.75rem 1rem; border-radius: 0.375rem; font-weight: 600; color: white; background-image: linear-gradient(to right, #00D1FF, #0052FF); transition: opacity 0.2s; }
              .btn-primary:hover { opacity: 0.9; }
              .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
};
