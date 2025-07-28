import React, { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WalletDashboard } from './components/WalletDashboard';
import { UnlockWallet } from './components/UnlockWallet';
import { DAppConnection } from './components/DAppConnection';
import { TransactionRequestDialog } from './components/DAppTransactionRequest';
import { ThemeProvider } from './components/ThemeProvider';
import { Wallet, DAppConnectionRequest, DAppTransactionRequest as DAppTransactionRequestType } from './types/wallet';
import { Toaster } from '@/components/ui/toaster';
import { ExtensionStorageManager } from './utils/extensionStorage';

function ExpandedApp() {
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

  // Listen for messages from other extension pages
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'SYNC_STATE') {
        if (message.data.wallets) {
          setWallets(message.data.wallets);
        }
        if (message.data.activeWallet) {
          setWallet(message.data.activeWallet);
        }
        if (message.data.isLocked !== undefined) {
          setIsLocked(message.data.isLocked);
        }
      } else if (message.type === 'STORAGE_CHANGED') {
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
    
    // Check for dApp requests in URL
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'send') {
      const to = urlParams.get('to');
      const amount = urlParams.get('amount');
      const successUrl = urlParams.get('success_url');
      const failureUrl = urlParams.get('failure_url');
      const origin = urlParams.get('origin');
      const appName = urlParams.get('app_name');
      const message = urlParams.get('message');
      
      if (to && amount && successUrl && failureUrl && origin) {
        setTransactionRequest({
          action: 'send',
          to: decodeURIComponent(to),
          amount: decodeURIComponent(amount),
          origin: decodeURIComponent(origin),
          successUrl: decodeURIComponent(successUrl),
          failureUrl: decodeURIComponent(failureUrl),
          appName: appName ? decodeURIComponent(appName) : undefined,
          message: message ? decodeURIComponent(message) : undefined
        });
      }
    } else {
      const successUrl = urlParams.get('success_url');
      const failureUrl = urlParams.get('failure_url');
      const origin = urlParams.get('origin');
      const appName = urlParams.get('app_name');
      
      if (successUrl && failureUrl && origin) {
        setConnectionRequest({
          origin: decodeURIComponent(origin),
          successUrl: decodeURIComponent(successUrl),
          failureUrl: decodeURIComponent(failureUrl),
          permissions: ['view_address', 'view_balance', 'call_methods'],
          appName: appName ? decodeURIComponent(appName) : undefined
        });
      }
    }
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

  const handleConnectionApprove = (selectedWallet: Wallet) => {
    if (!connectionRequest) return;
    
    const successUrl = new URL(connectionRequest.successUrl);
    successUrl.searchParams.set('account_id', selectedWallet.address);
    if (selectedWallet.publicKey) {
      successUrl.searchParams.set('public_key', selectedWallet.publicKey);
    }
    
    setConnectionRequest(null);
    setSelectedWalletForConnection(null);
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.href = successUrl.toString();
  };

  const handleConnectionReject = () => {
    if (!connectionRequest) return;
    
    setConnectionRequest(null);
    setSelectedWalletForConnection(null);
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.href = connectionRequest.failureUrl;
  };

  const handleTransactionApprove = (txHash: string) => {
    if (!transactionRequest) return;
    
    const successUrl = new URL(transactionRequest.successUrl);
    successUrl.searchParams.set('tx_hash', txHash);
    window.location.href = successUrl.toString();
  };

  const handleTransactionReject = () => {
    if (!transactionRequest) return;
    window.location.href = transactionRequest.failureUrl;
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

  if (transactionRequest && wallets.length > 0) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
        <div className="min-h-screen bg-background">
          <TransactionRequestDialog
            transactionRequest={transactionRequest}
            wallets={wallets}
            selectedWallet={selectedWalletForTransaction}
            connectedWallet={connectedDAppWallet}
            onWalletSelect={setSelectedWalletForTransaction}
            onApprove={handleTransactionApprove}
            onReject={handleTransactionReject}
          />
          <Toaster />
        </div>
      </ThemeProvider>
    );
  }

  if (connectionRequest && wallets.length > 0) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
        <div className="min-h-screen bg-background">
          <DAppConnection
            connectionRequest={connectionRequest}
            wallets={wallets}
            selectedWallet={selectedWalletForConnection}
            onWalletSelect={setSelectedWalletForConnection}
            onApprove={handleConnectionApprove}
            onReject={handleConnectionReject}
          />
          <Toaster />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="octra-wallet-theme">
      <div className="min-h-screen bg-background expanded-view">
        {!wallet ? (
          <WelcomeScreen onWalletCreated={addWallet} />
        ) : (
          <WalletDashboard 
            wallet={wallet} 
            wallets={wallets}
            onDisconnect={disconnectWallet}
            onSwitchWallet={switchWallet}
            onAddWallet={addWallet}
            onRemoveWallet={removeWallet}
          />
        )}
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default ExpandedApp;