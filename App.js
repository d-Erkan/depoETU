import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './config';

function App() {
  // State
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  
  // Blockchain state
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [isWeb3Enabled, setIsWeb3Enabled] = useState(false);
  const [blockchainMode, setBlockchainMode] = useState(false); // true = blockchain, false = localStorage

  // Check if MetaMask is installed
  const checkWeb3 = () => {
    if (typeof window.ethereum !== 'undefined') {
      console.log('MetaMask is installed!');
      return true;
    }
    console.log('MetaMask not found, using localStorage mode');
    return false;
  };

  // Initialize blockchain connection
  const initBlockchain = async () => {
    if (!checkWeb3()) {
      setIsWeb3Enabled(false);
      return;
    }

    try {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);
      
      const web3Signer = await web3Provider.getSigner();
      
      const platformContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        web3Signer
      );
      setContract(platformContract);
      
      setIsWeb3Enabled(true);
      console.log('Blockchain initialized successfully');
      
      // Listen to contract events
      platformContract.on("PostCreated", (postId, author, timestamp) => {
        console.log(`New post created: ${postId}`);
        fetchPostsFromBlockchain();
      });
      
      platformContract.on("PostVoted", (postId, voter, isUpvote) => {
        console.log(`Post ${postId} voted by ${voter}`);
        fetchPostsFromBlockchain();
      });
      
    } catch (error) {
      console.error('Blockchain initialization failed:', error);
      setIsWeb3Enabled(false);
    }
  };

  // Fake wallet address generator (for demo mode)
  const generateWalletAddress = () => {
    return '0x' + Math.random().toString(16).substr(2, 40);
  };

  // Load data on mount
  useEffect(() => {
    initBlockchain();
    
    const savedUser = localStorage.getItem('web3User');
    const savedPosts = localStorage.getItem('web3Posts');
    const savedMode = localStorage.getItem('blockchainMode');
    
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    if (savedPosts) {
      setPosts(JSON.parse(savedPosts));
    }
    if (savedMode) {
      setBlockchainMode(JSON.parse(savedMode));
    }
    
    // Cleanup listeners on unmount
    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect Wallet (Real MetaMask or Demo)
  const connectWallet = async () => {
    if (!checkWeb3()) {
      // No MetaMask, use demo mode
      setShowLogin(true);
      return;
    }

    try {
      setLoading(true);
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const userAddress = accounts[0];
      
      // Get network
      const network = await provider.getNetwork();
      console.log('Connected to network:', network.chainId);
      
      // Check if on correct network (localhost or Sepolia)
      if (network.chainId !== 31337n && network.chainId !== 11155111n) {
        alert('⚠️ Lütfen Localhost (31337) veya Sepolia (11155111) ağına bağlanın!');
        setLoading(false);
        return;
      }
      
      // Get user reputation from blockchain
      let reputation = 0;
      try {
        reputation = await contract.getReputation(userAddress);
        reputation = Number(reputation);
      } catch (error) {
        console.log('Could not fetch reputation:', error);
      }
      
      const user = {
        username: `User_${userAddress.slice(2, 8)}`,
        address: userAddress,
        reputation: reputation,
        joinedAt: new Date().toISOString()
      };

      setCurrentUser(user);
      localStorage.setItem('web3User', JSON.stringify(user));
      setBlockchainMode(true);
      localStorage.setItem('blockchainMode', JSON.stringify(true));
      
      // Fetch posts from blockchain
      await fetchPostsFromBlockchain();
      
      setLoading(false);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('❌ Cüzdan bağlantısı başarısız! Demo moduna geçiliyor.');
      setShowLogin(true);
      setLoading(false);
    }
  };

  // Fetch posts from blockchain
  const fetchPostsFromBlockchain = async () => {
    if (!contract) return;
    
    try {
      const totalPosts = await contract.getTotalPosts();
      const postsArray = [];
      
      for (let i = 0; i < totalPosts; i++) {
        try {
          const post = await contract.getPost(i);
          postsArray.push({
            id: Number(post.id),
            content: post.content,
            author: `User_${post.author.slice(2, 8)}`,
            authorAddress: post.author,
            votes: Number(post.upvotes) - Number(post.downvotes),
            upvotes: Number(post.upvotes),
            downvotes: Number(post.downvotes),
            timestamp: new Date(Number(post.timestamp) * 1000).toISOString(),
            voters: []
          });
        } catch (err) {
          console.log(`Error fetching post ${i}:`, err);
        }
      }
      
      setPosts(postsArray.reverse()); // Newest first
      localStorage.setItem('web3Posts', JSON.stringify(postsArray));
    } catch (error) {
      console.error('Error fetching posts from blockchain:', error);
    }
  };

  // Login
  const handleLogin = () => {
    if (!username.trim()) {
      alert('Lütfen bir kullanıcı adı girin!');
      return;
    }

    const user = {
      username: username,
      address: generateWalletAddress(),
      reputation: 0,
      joinedAt: new Date().toISOString()
    };

    setCurrentUser(user);
    localStorage.setItem('web3User', JSON.stringify(user));
    setShowLogin(false);
    setUsername('');
  };

  // Logout
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('web3User');
    setBlockchainMode(false);
    localStorage.removeItem('blockchainMode');
  };

  // Create Post - Blockchain or LocalStorage
  const createPost = async () => {
    if (!newPostContent.trim()) {
      alert('Lütfen bir içerik yazın!');
      return;
    }

    setLoading(true);

    // Try blockchain first if enabled
    if (blockchainMode && contract && isWeb3Enabled) {
      try {
        console.log('Creating post on blockchain...');
        
        // Estimate gas
        const gasEstimate = await contract.createPost.estimateGas(newPostContent);
        console.log('Gas estimate:', gasEstimate.toString());
        
        // Send transaction
        const tx = await contract.createPost(newPostContent);
        console.log('Transaction sent:', tx.hash);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.hash);
        
        alert('✅ Post blockchain\'e yazıldı! TX: ' + receipt.hash.slice(0, 10) + '...');
        
        // Fetch updated posts
        await fetchPostsFromBlockchain();
        
        setNewPostContent('');
        setLoading(false);
        return;
      } catch (error) {
        console.error('Blockchain post failed:', error);
        
        if (error.code === 'ACTION_REJECTED') {
          alert('❌ İşlem kullanıcı tarafından reddedildi');
          setLoading(false);
          return;
        } else if (error.code === 'INSUFFICIENT_FUNDS') {
          alert('⚠️ Yetersiz ETH bakiyesi! LocalStorage\'a kaydediliyor...');
        } else {
          alert('⚠️ Blockchain hatası! LocalStorage\'a kaydediliyor...');
        }
      }
    }

    // Fallback to localStorage
    console.log('Using localStorage mode...');
    setTimeout(() => {
      const newPost = {
        id: Date.now(),
        content: newPostContent,
        author: currentUser.username,
        authorAddress: currentUser.address,
        votes: 0,
        upvotes: 0,
        downvotes: 0,
        timestamp: new Date().toISOString(),
        voters: []
      };

      const updatedPosts = [newPost, ...posts];
      setPosts(updatedPosts);
      localStorage.setItem('web3Posts', JSON.stringify(updatedPosts));
      
      setNewPostContent('');
      setLoading(false);
    }, 1000);
  };

  // Vote on Post - Blockchain or LocalStorage
  const votePost = async (postId, voteType) => {
    if (!currentUser) return;

    setLoading(true);

    // Try blockchain first if enabled
    if (blockchainMode && contract && isWeb3Enabled) {
      try {
        console.log(`Voting ${voteType} on post ${postId} via blockchain...`);
        
        let tx;
        if (voteType === 'up') {
          tx = await contract.upvote(postId);
        } else {
          tx = await contract.downvote(postId);
        }
        
        console.log('Vote transaction sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('Vote confirmed:', receipt.hash);
        
        alert(`✅ Oy blockchain'e kaydedildi! TX: ${receipt.hash.slice(0, 10)}...`);
        
        // Fetch updated posts and reputation
        await fetchPostsFromBlockchain();
        
        // Update user reputation
        const newReputation = await contract.getReputation(currentUser.address);
        const updatedUser = {
          ...currentUser,
          reputation: Number(newReputation)
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('web3User', JSON.stringify(updatedUser));
        
        setLoading(false);
        return;
      } catch (error) {
        console.error('Blockchain vote failed:', error);
        
        if (error.code === 'ACTION_REJECTED') {
          alert('❌ İşlem kullanıcı tarafından reddedildi');
          setLoading(false);
          return;
        } else if (error.message && error.message.includes('Already voted')) {
          alert('⚠️ Bu posta zaten oy verdiniz!');
          setLoading(false);
          return;
        } else {
          alert('⚠️ Blockchain hatası! LocalStorage\'a kaydediliyor...');
        }
      }
    }

    // Fallback to localStorage
    console.log('Using localStorage vote...');
    setTimeout(() => {
      const updatedPosts = posts.map(post => {
        if (post.id === postId) {
          // Check if user already voted
          if (post.voters && post.voters.includes(currentUser.address)) {
            alert('Bu gönderiyi zaten oyladınız!');
            return post;
          }

          const newVoters = post.voters ? [...post.voters, currentUser.address] : [currentUser.address];
          const voteChange = voteType === 'up' ? 1 : -1;
          
          return {
            ...post,
            votes: (post.votes || 0) + voteChange,
            upvotes: voteType === 'up' ? (post.upvotes || 0) + 1 : (post.upvotes || 0),
            downvotes: voteType === 'down' ? (post.downvotes || 0) + 1 : (post.downvotes || 0),
            voters: newVoters
          };
        }
        return post;
      });

      setPosts(updatedPosts);
      localStorage.setItem('web3Posts', JSON.stringify(updatedPosts));

      // Update user reputation
      const userPosts = updatedPosts.filter(p => p.authorAddress === currentUser.address);
      const totalReputation = userPosts.reduce((sum, p) => sum + (p.votes || 0), 0);
      const updatedUser = { ...currentUser, reputation: totalReputation };
      setCurrentUser(updatedUser);
      localStorage.setItem('web3User', JSON.stringify(updatedUser));

      setLoading(false);
    }, 800);
  };

  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <img src="/logo.png" alt="TOBB ETÜ Logo" className="logo" />
          <div className="header-text">
            <h1>📚 depo ETU</h1>
            <p className="subtitle">Öğrencilerin Merkeziyetsiz Platformu</p>
            {blockchainMode && isWeb3Enabled && (
              <p className="blockchain-indicator" style={{color: '#4ade80', fontSize: '0.9rem', marginTop: '0.3rem'}}>
                ⛓️ Blockchain Mode Active
              </p>
            )}
            {!blockchainMode && (
              <p className="demo-indicator" style={{color: '#fbbf24', fontSize: '0.9rem', marginTop: '0.3rem'}}>
                💾 Demo Mode (localStorage)
              </p>
            )}
          </div>
        </div>
        
        {!currentUser ? (
          <button className="connect-button" onClick={connectWallet}>
            🦊 Cüzdan Bağla
          </button>
        ) : (
          <div className="wallet-info">
            <p className="connected">
              ✅ Bağlı: {currentUser.username}
            </p>
            <p className="address-display">
              🔑 {currentUser.address.slice(0, 6)}...{currentUser.address.slice(-4)}
            </p>
            <p className="reputation">⭐ İtibar Puanı: {currentUser.reputation}</p>
            <button className="logout-button" onClick={handleLogout}>
              Çıkış Yap
            </button>
          </div>
        )}
      </header>

      {/* Login Modal */}
      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🦊 Cüzdan Bağla</h2>
            <p className="modal-subtitle">Demo için kullanıcı adınızı girin</p>
            <input
              type="text"
              className="login-input"
              placeholder="Kullanıcı adı girin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <div className="modal-buttons">
              <button className="modal-button primary" onClick={handleLogin}>
                Bağlan
              </button>
              <button className="modal-button" onClick={() => setShowLogin(false)}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {currentUser && (
        <div className="container">
          {/* Create Post */}
          <div className="create-post-section">
            <h2>✍️ Yeni Gönderi Paylaş</h2>
            <textarea
              className="post-input"
              placeholder="Ne düşünüyorsun? (Blockchain'de saklanacak)"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows="4"
              disabled={loading}
            />
            <button 
              className="share-button" 
              onClick={createPost}
              disabled={loading || !newPostContent.trim()}
            >
              {loading ? '⏳ Blockchain\'e yazılıyor...' : '📤 Paylaş'}
            </button>
          </div>

          {/* Posts List */}
          <div className="posts-section">
            <h2>📝 Blockchain Gönderileri</h2>
            
            {loading && posts.length === 0 ? (
              <p className="loading">⏳ Blockchain\'den gönderiler yükleniyor...</p>
            ) : posts.length === 0 ? (
              <p className="no-posts">Henüz gönderi yok. İlk gönderiyi sen paylaş!</p>
            ) : (
              <div className="posts-list">
                {posts.map((post) => (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div>
                        <span className="post-author">👤 {post.author}</span>
                        <span className="post-address">
                          ({post.authorAddress.slice(0, 6)}...{post.authorAddress.slice(-4)})
                        </span>
                      </div>
                      <span className="post-date">
                        🕒 {new Date(post.timestamp).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <p className="post-content">{post.content}</p>
                    <div className="post-footer">
                      <span className="votes">
                        👍 {post.votes} Oy
                      </span>
                      <div className="vote-buttons">
                        <button 
                          className="vote-button upvote"
                          onClick={() => votePost(post.id, 1)}
                          disabled={loading || post.voters.includes(currentUser.address)}
                        >
                          ⬆️ Upvote
                        </button>
                        <button 
                          className="vote-button downvote"
                          onClick={() => votePost(post.id, -1)}
                          disabled={loading || post.voters.includes(currentUser.address)}
                        >
                          ⬇️ Downvote
                        </button>
                      </div>
                    </div>
                    {post.voters.includes(currentUser.address) && (
                      <p className="voted-message">✅ Oylandı</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!currentUser && (
        <div className="welcome-message">
          <h2>Hoş Geldiniz! 👋</h2>
          <p>Blockchain tabanlı sosyal platformumuza katılın</p>
          <div className="features">
            <div className="feature">✅ Merkeziyetsiz gönderi paylaşımı</div>
            <div className="feature">✅ Blockchain üzerinde güvenli oylama</div>
            <div className="feature">✅ İtibar puanı sistemi</div>
            <div className="feature">✅ Anonim ve şeffaf</div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>🔗 Blockchain Powered | 🔒 Decentralized | 🎓 Web3 Social Network</p>
      </footer>
    </div>
  );
}

export default App;
