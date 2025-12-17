/**
 * Blockchain Context Provider
 * Provides Web3 state and functions throughout the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config';
import {
  isMetaMaskInstalled,
  requestAccounts,
  isCorrectNetwork,
  switchNetwork,
  onAccountsChanged,
  onChainChanged,
  removeAllListeners,
  getBalance
} from '../utils/web3Utils';

const BlockchainContext = createContext();

export const useBlockchain = () => {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error('useBlockchain must be used within BlockchainProvider');
  }
  return context;
};

export const BlockchainProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Initialize provider and contract
   */
  const initProvider = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      console.log('MetaMask not installed');
      return;
    }

    try {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      const network = await web3Provider.getNetwork();
      setChainId(Number(network.chainId));

      // Check if already connected
      const accounts = await web3Provider.listAccounts();
      if (accounts.length > 0) {
        const signer = await web3Provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);

        // Initialize contract
        const platformContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );
        setContract(platformContract);

        // Get balance
        const bal = await getBalance(web3Provider, address);
        setBalance(bal);
      }
    } catch (err) {
      console.error('Provider initialization error:', err);
      setError(err.message);
    }
  }, []);

  /**
   * Connect wallet
   */
  const connect = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('Please install MetaMask to use this feature');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request accounts
      const accounts = await requestAccounts();
      const userAddress = accounts[0];

      // Check network
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const correctNetwork = await isCorrectNetwork(web3Provider);

      if (!correctNetwork) {
        // Try to switch to localhost
        try {
          await switchNetwork('0x7A69'); // 31337 in hex
        } catch (switchError) {
          setError('Please switch to Localhost (31337) or Sepolia (11155111) network');
          setIsConnecting(false);
          return false;
        }
      }

      // Get signer
      const signer = await web3Provider.getSigner();

      // Initialize contract
      const platformContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      // Get balance
      const bal = await getBalance(web3Provider, userAddress);

      // Update state
      setProvider(web3Provider);
      setContract(platformContract);
      setAccount(userAddress);
      setBalance(bal);

      const network = await web3Provider.getNetwork();
      setChainId(Number(network.chainId));

      setIsConnecting(false);
      return true;

    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
      setIsConnecting(false);
      return false;
    }
  }, []);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    setProvider(null);
    setContract(null);
    setAccount(null);
    setBalance('0');
    setChainId(null);
    setError(null);
  }, []);

  /**
   * Refresh balance
   */
  const refreshBalance = useCallback(async () => {
    if (provider && account) {
      try {
        const bal = await getBalance(provider, account);
        setBalance(bal);
      } catch (err) {
        console.error('Balance refresh error:', err);
      }
    }
  }, [provider, account]);

  /**
   * Handle account changes
   */
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== account) {
        // Account changed, reinitialize
        initProvider();
      }
    };

    onAccountsChanged(handleAccountsChanged);

    return () => {
      removeAllListeners();
    };
  }, [account, disconnect, initProvider]);

  /**
   * Handle chain changes
   */
  useEffect(() => {
    const handleChainChanged = (chainId) => {
      // Page reload recommended by MetaMask on chain change
      window.location.reload();
    };

    onChainChanged(handleChainChanged);

    return () => {
      removeAllListeners();
    };
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initProvider();
  }, [initProvider]);

  const value = {
    provider,
    contract,
    account,
    chainId,
    balance,
    isConnecting,
    error,
    isConnected: !!account,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    connect,
    disconnect,
    refreshBalance
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
};
