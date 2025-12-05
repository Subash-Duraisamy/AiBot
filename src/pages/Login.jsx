import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { createUserProfile } from "../utils/createUserProfile";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log("Logged in as:", user.uid);

      // AUTO CREATE PROFILE
      await createUserProfile(user);

      // 🔥 NAVIGATE TO CHAT PAGE
      navigate("/chat");

    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div style={{ padding: 50 }}>
      <h1>Welcome Subash 👋</h1>
      <button onClick={handleLogin}>Login with Google</button>
    </div>
  );
}
