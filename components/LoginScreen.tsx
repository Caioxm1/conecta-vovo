import React from 'react';
import { auth, googleProvider, db } from '../firebase'; // Importamos o Firebase
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// As props 'users' e 'onLogin' não são mais necessárias
const LoginScreen: React.FC = () => {
  
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user) {
        // Salva ou atualiza o usuário no banco de dados Firestore
        // Isso é importante para que outros usuários possam encontrá-lo
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          id: user.uid,
          name: user.displayName || 'Usuário',
          avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/200`,
          relationship: 'Família', // Você pode criar uma tela para definir isso depois
          status: 'online',
          lastSeen: serverTimestamp(),
        }, { merge: true }); // 'merge: true' garante que não vamos sobrescrever dados
      }
      // O App.tsx vai detectar o login automaticamente, não precisamos chamar 'onLogin'
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      alert("Houve um erro ao tentar fazer login. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-green-800">Conecta Vovó</h1>
        <p className="text-xl text-green-600 mt-2">Feito com amor para a Vovó se conectar com a família.</p>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-semibold text-center text-gray-700 mb-8">Quem está usando?</h2>
        <div className="space-y-4">
          
          {/* Trocamos a lista de usuários por um botão de login */}
          <button
            key="google-login"
            onClick={handleGoogleLogin}
            className="w-full flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" 
              alt="Google Logo" 
              className="w-16 h-16 p-2 rounded-full mr-6 border-4 border-white shadow-md" 
            />
            <div>
              <p className="text-2xl font-bold text-gray-800">Entrar com Google</p>
              <p className="text-lg text-gray-500">Use sua conta Google</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
};

export default LoginScreen;