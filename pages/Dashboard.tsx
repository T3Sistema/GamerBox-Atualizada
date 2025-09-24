
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Participant, Raffle } from '../types';
import { TrophyIcon } from '../components/icons/TrophyIcon';

const CountdownDisplay: React.FC<{ count: number }> = ({ count }) => (
  <div key={count} className="animate-pop text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-dark-primary to-dark-secondary">
    {count}
  </div>
);

const maskPhone = (phone: string): string => {
    if (!phone) return phone;
    const parts = phone.split('-');
    if (parts.length !== 2) return phone;
    const firstPart = parts[0];
    const lastPart = parts[1];
    const areaCodeMatch = firstPart.match(/\(\d{2}\)\s*/);
    const areaCode = areaCodeMatch ? areaCodeMatch[0] : '';
    const numberWithoutAreaCode = firstPart.substring(areaCode.length).trim();
    if (numberWithoutAreaCode.length === 5) {
        const masked = numberWithoutAreaCode.charAt(0) + '****';
        return `${areaCode}${masked}-${lastPart}`;
    } else if (numberWithoutAreaCode.length === 4) {
        const masked = '****';
        return `${areaCode}${masked}-${lastPart}`;
    }
    return phone;
}

const WinnerDisplay: React.FC<{ winner: Participant, raffle: Raffle | null }> = ({ winner, raffle }) => (
  <div className="animate-fadeIn text-center bg-light-card dark:bg-dark-card p-8 rounded-lg shadow-2xl border border-light-border dark:border-dark-border shadow-primary/30 dark:shadow-primary/20">
    <TrophyIcon className="w-24 h-24 mx-auto text-yellow-400 mb-4" />
    <h3 className="text-2xl font-semibold text-gray-500 dark:text-gray-400">Ganhador do Sorteio <span className="text-yellow-400">{raffle?.name}</span>:</h3>
    <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary my-2">{winner.name}</p>
    <p className="text-2xl text-light-text dark:text-dark-text">{maskPhone(winner.phone)}</p>
  </div>
);

const EventSelector: React.FC = () => {
    const { organizerEvents, selectedEvent, setSelectedEventId, setSelectedRaffleId, clearRaffleSelection } = useData();

    if (organizerEvents.length <= 1) return null;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedEventId(e.target.value);
        setSelectedRaffleId(null); // Reset single raffle selection for other pages
        clearRaffleSelection(); // Reset multi raffle selection for this page
    }

    return (
        <div className="absolute top-4 left-4">
            <label htmlFor="event-select" className="sr-only">Selecionar Evento</label>
            <select
                id="event-select"
                value={selectedEvent?.id || ''}
                onChange={handleChange}
                className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md shadow-sm p-2 focus:outline-none focus:ring-light-primary focus:border-light-primary dark:focus:ring-dark-primary dark:focus:border-dark-primary"
            >
                {organizerEvents.map(event => (
                    <option key={event.id} value={event.id}>
                        {event.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

const MultiRaffleSelector: React.FC = () => {
    const { selectedEventRaffles, selectedRaffleIds, toggleRaffleSelection } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);


    if (selectedEventRaffles.length === 0) return null;
    
    const selectedCount = selectedRaffleIds.length;
    const buttonText = selectedCount === 0
        ? '-- Selecione o Sorteio --'
        : `${selectedCount} sorteio${selectedCount > 1 ? 's' : ''} selecionado${selectedCount > 1 ? 's' : ''}`;


    return (
        <div ref={wrapperRef} className="absolute top-4 right-4 z-20">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md shadow-sm p-2 w-64 text-left flex justify-between items-center"
            >
                <span className="truncate">{buttonText}</span>
                 <svg className="w-5 h-5 ml-2 -mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-md shadow-lg">
                    <ul className="max-h-60 overflow-y-auto p-2 space-y-1">
                        {selectedEventRaffles.map(raffle => (
                            <li key={raffle.id} className="rounded-md hover:bg-light-border dark:hover:bg-dark-border">
                                <label className="flex items-center space-x-3 p-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedRaffleIds.includes(raffle.id)} 
                                        onChange={() => toggleRaffleSelection(raffle.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-light-primary dark:text-dark-primary focus:ring-light-primary dark:focus:ring-dark-primary dark:bg-dark-background dark:border-dark-border"
                                    />
                                    <span className="text-sm font-medium text-light-text dark:text-dark-text">{raffle.name}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export const Dashboard: React.FC = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [noEligible, setNoEligible] = useState(false);
  
  const { 
    drawWinnerFromSelection, 
    getEligibleParticipantCountForSelection, 
    selectedEvent, 
    selectedRaffles,
    selectedRaffleIds,
    selectedEventRaffles,
  } = useData();
  
  const eligibleCount = getEligibleParticipantCountForSelection();

  useEffect(() => {
    setWinner(null);
    setNoEligible(false);
    setIsDrawing(false);
    setCountdown(null);
  }, [selectedEvent, selectedRaffleIds]);

  useEffect(() => {
    if (countdown === null || countdown === 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  
  const handleDraw = useCallback(async () => {
    if (eligibleCount === 0) {
      setNoEligible(true);
      return;
    }

    setIsDrawing(true);
    setWinner(null);
    setNoEligible(false);
    setCountdown(5);

    setTimeout(async () => {
      setCountdown(null);
      const drawnWinner = await drawWinnerFromSelection();
      setWinner(drawnWinner);
      setIsDrawing(false);
    }, 5000);
  }, [drawWinnerFromSelection, eligibleCount]);
  
  const winnerRaffle = useMemo(() => {
    if (!winner) return null;
    return selectedEventRaffles.find(r => r.id === winner.raffleId) || null;
  }, [winner, selectedEventRaffles]);

  const renderContent = () => {
    if (!selectedEvent) {
        return <p className="text-2xl text-center text-gray-500">Nenhum evento selecionado. Vá para a tela "Gerenciar" para criar seu primeiro evento e sorteio.</p>;
    }
    if (selectedRaffles.length === 0) {
        return <p className="text-2xl text-center text-gray-500">Selecione um ou mais sorteios no canto superior direito para começar.</p>;
    }
    if (isDrawing && countdown !== null) {
      return <CountdownDisplay count={countdown} />;
    }
    if (winner) {
      return <WinnerDisplay winner={winner} raffle={winnerRaffle} />;
    }
    if (noEligible) {
        return <p className="text-2xl text-center text-red-500">Todos os participantes para os sorteios selecionados já foram sorteados!</p>
    }
    
    const raffleNames = selectedRaffles.map(r => r.name).join(' & ');
    return (
        <div className="text-center">
            <h2 className="text-4xl font-bold text-light-text dark:text-dark-text mb-4">Sorteio para <span className="text-transparent bg-clip-text bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary">{raffleNames}</span></h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                Total de {eligibleCount} participante{eligibleCount !== 1 ? 's' : ''} habilitado(s) para este sorteio!
            </p>
        </div>
    );
  };

  return (
    <div className="relative container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-128px)]">
      <EventSelector />
      {selectedEvent && <MultiRaffleSelector />}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-center min-h-[250px]">
        {renderContent()}
      </div>
      <button
        onClick={handleDraw}
        disabled={isDrawing || eligibleCount === 0 || !selectedEvent || selectedRaffles.length === 0}
        className="px-12 py-6 text-2xl font-bold text-white bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary rounded-lg shadow-lg hover:scale-105 active:scale-100 transition-all duration-300 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed disabled:transform-none animate-pulse disabled:animate-none"
      >
        {winner ? 'Sortear Novamente' : 'Sortear!'}
      </button>
    </div>
  );
};