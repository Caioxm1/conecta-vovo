import React from 'react';
import { auth, googleProvider } from '../firebase'; // Apenas 'auth' e 'googleProvider'
import { signInWithPopup } from 'firebase/auth';
// REMOVIDO: doc, setDoc, serverTimestamp

const LoginScreen: React.FC = () => {
  
  const handleGoogleLogin = async () => {
    try {
      // A única responsabilidade deste componente é fazer o login.
      // O App.tsx vai lidar com o que fazer com o usuário.
      await signInWithPopup(auth, googleProvider);
      
      // REMOVIDO: Toda a lógica de setDoc, pendingUsers, alert e signOut
      
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      alert("Houve um erro ao tentar fazer login. Tente novamente.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-green-50 p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-green-800">Conecta Vovó</h1>
        <p className="text-xl text-green-600 mt-2">Feito com amor para a Vovó se conectar com a família.</p>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-semibold text-center text-gray-700 mb-8">Quem está usando?</h2>
        <div className="space-y-4">
          
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