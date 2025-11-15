import React from 'react';
import { auth, googleProvider, db } from '../firebase'; // Importamos o Firebase
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; // serverTimestamp importado

const LoginScreen: React.FC = () => {
  
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user) {
        // --- LÓGICA DE LOGIN MODIFICADA ---
        
        // 1. Salva o novo usuário na "sala de espera" (pendingUsers) para aprovação
        const pendingUserRef = doc(db, 'pendingUsers', user.uid);
        await setDoc(pendingUserRef, {
          id: user.uid,
          name: user.displayName || 'Usuário',
          avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/200`,
          email: user.email, // Salva o email para o Admin saber quem é
          status: 'pending',
          requestedAt: serverTimestamp(),
        }, { merge: true }); // 'merge: true' caso ele tente logar de novo

        // 2. Avisa o usuário que ele precisa esperar
        alert("Obrigado por se registrar!\n\nSeu acesso precisa ser aprovado por um administrador. Por favor, aguarde e tente novamente mais tarde.");
        
        // 3. Desloga o usuário até ele ser aprovado
        auth.signOut();
      }
      
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      
      // Se o erro for de "usuário não aprovado" (que vamos forçar), não mostra
      if (error.code !== "auth/user-not-found") { // Exemplo, pode ser outro
         alert("Houve um erro ao tentar fazer login. Tente novamente.");
      }
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