import React, { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WalletDashboard } from './components/WalletDashboard';
import { UnlockWallet } from './components/UnlockWallet';
import { DAppConnection } from './components/DAppConnection';
import { TransactionRequestDialog } from './components/DAppTransactionRequest';
import { ThemeProvider } from './components/ThemeProvider';
import { Wallet, DAppConnectionRequest, DAppTransactionRequest as DAppTransactionRequestType } from './types/wallet';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { ExtensionStorageManager } from './utils/extensionStorage';

function PopupApp() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [connectionRequest, setConnectionRequest] = useState<DAppConnectionRequest | null>(null);
  const [selectedWalletForConnection, setSelectedWalletForConnection] = useState<Wallet | null>(null);
  const [transactionRequest, setTransactionRequest] = useState<DAppTransactionRequestType | null>(null);
  const [selectedWalletForTransaction, setSelectedWalletForTransaction] = useState<Wallet | null>(null);
  const [connectedDAppWallet, setConnectedDAppWallet] = useState<Wallet | null>(null);

  // Initialize extension storage manager
  useEffect(() => {
    ExtensionStorageManager.init();
  }, []);

  // Listen for storage changes from other extension pages
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'STORAGE_CHANGED') {
        // Reload wallet data when storage changes
        loadWalletData();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
      };
    }
  }, []);

  const loadWalletData = async () => {
    try {
      const isWalletLocked = await ExtensionStorageManager.get('isWalletLocked');
      const hasPassword = await ExtensionStorageManager.get('walletPasswordHash');
      
      if (hasPassword && isWalletLocked !== 'false') {
        setIsLocked(true);
        return;
      }

      const storedWallets = await ExtensionStorageManager.get('wallets');
      const activeWalletId = await ExtensionStorageManager.get('activeWalletId');
      
      if (storedWallets) {
        const parsedWallets = JSON.parse(storedWallets);
        setWallets(parsedWallets);
        
        if (parsedWallets.length > 0) {
          let activeWallet = parsedWallets[0];
          if (activeWalletId) {
            const foundWallet = parsedWallets.find((w: Wallet) => w.address === activeWalletId);
            if (foundWallet) {
              activeWallet = foundWallet;
            }
          }
          setWallet(activeWallet);
        }
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const handleUnlock = (unlockedWallets: Wallet[]) => {
    setWallets(unlockedWallets);
    setIsLocked(false);
    
    if (unlockedWallets.length > 0) {
      const activeWalletId = localStorage.getItem('activeWalletId');
      let activeWallet = unlockedWallets[0];
      if (activeWalletId) {
        const foundWallet = unlockedWallets.find(w => w.address === activeWalletId);
        if (foundWallet) {
          activeWallet = foundWallet;
        }
      }
      setWallet(activeWallet);
    }
  };

  const addWallet = async (newWallet: Wallet) => {
    const existingWallet = wallets.find(w => w.address === newWallet.address);
    if (existingWallet) {
      setWallet(existingWallet);
      await ExtensionStorageManager.set('activeWalletId', existingWallet.address);
      return;
    }
    
    const updatedWallets = [...wallets, newWallet];
    setWallets(updatedWallets);
    setWallet(newWallet);
    
    await ExtensionStorageManager.set('wallets', JSON.stringify(updatedWallets));
    await ExtensionStorageManager.set('activeWalletId', newWallet.address);
    
    // Sync with other extension pages
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'SYNC_STATE',
        data: { wallets: updatedWallets, activeWallet: newWallet }
      }).catch(() => {});
    }
  };

  const switchWallet = async (selectedWallet: Wallet) => {
    setWallet(selectedWallet);
    await ExtensionStorageManager.set('activeWalletId', selectedWallet.address);
    
    // Sync with other extension pages
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'SYNC_STATE',
        data: { activeWallet: selectedWallet }
      }).catch(() => {});
    }
  };

  const removeWallet = async (walletToRemove: Wallet) => {
    const updatedWallets = wallets.filter(w => w.address !== walletToRemove.address);
    setWallets(updatedWallets);
    await ExtensionStorageManager.set('wallets', JSON.stringify(updatedWallets));
    
    if (wallet?.address === walletToRemove.address && updatedWallets.length === 0) {
      setWallet(null);
      await ExtensionStorageManager.remove('activeWalletId');
    }
    
    // Sync with other extension pages
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'SYNC_STATE',
        data: { wallets: updatedWallets }
      }).catch(() => {});
    }
  };

  const disconnectWallet = async () => {
    setWallet(null);
    setWallets([]);
    setIsLocked(true);
    await ExtensionStorageManager.set('isWalletLocked', 'true');
    
    // Sync with other extension pages
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'SYNC_STATE',
        data: { isLocked: true }
      }).catch(() => {});
    }
  };

  const openExpanded = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'OPEN_EXPANDED' });
    }
  };

  if (isLocked) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
        <div className="min-h-screen bg-background">
          <UnlockWallet onUnlock={handleUnlock} />
          <Toaster />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
      <div className="min-h-screen bg-background">
        {!wallet ? (
          <div className="p-4">
            <WelcomeScreen onWalletCreated={addWallet} />
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={openExpanded}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Full View
              </Button>
            </div>
          </div>
        ) : (
          <div className="popup-view">
            {/* Compact header */}
            <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">Octra Wallet</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openExpanded}
                  className="h-6 w-6 p-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {/* Compact dashboard */}
            <div className="p-2">
              <WalletDashboard 
                wallet={wallet} 
                wallets={wallets}
                onDisconnect={disconnectWallet}
                onSwitchWallet={switchWallet}
                onAddWallet={addWallet}
                onRemoveWallet={removeWallet}
              />
            </div>
          </div>
        )}
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default PopupApp;