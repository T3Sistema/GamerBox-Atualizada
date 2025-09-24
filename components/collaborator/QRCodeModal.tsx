import React, { useState } from 'react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataUrl: string;
  cleanUrl: string;
  companyName: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, dataUrl, cleanUrl, companyName }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qrcode_roleta_${companyName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleCopy = () => {
      navigator.clipboard.writeText(cleanUrl).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fadeIn p-4" onClick={onClose}>
      <div className="bg-light-card dark:bg-dark-card p-8 rounded-lg shadow-2xl text-center border border-light-primary/50 dark:border-dark-primary" onClick={e => e.stopPropagation()}>
        <h3 className="text-2xl font-bold text-light-primary dark:text-dark-primary mb-2">QR Code da Roleta</h3>
        <p className="text-xl text-light-text dark:text-dark-text mb-4">{companyName}</p>
        <img src={dataUrl} alt={`QR Code for Roleta de ${companyName}`} className="mx-auto border-4 border-white rounded-lg"/>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 break-all max-w-xs">{cleanUrl}</p> 
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <button 
            onClick={handleDownload}
            className="flex-1 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            Baixar PNG
          </button>
           <button 
            onClick={handleCopy}
            className="flex-1 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            {copied ? 'Copiado!' : 'Copiar Link'}
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};