import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function createUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      displayName: user.displayName || "",
      email: user.email || "",
      createdAt: new Date().toISOString(),
    });

    await setDoc(doc(db, "users", user.uid, "streak", "data"), {
      currentStreak: 0,
      lastUpdated: "",
    });

    console.log("✔ User profile auto-created");
  } else {
    console.log("ℹ User already exists");
  }
}
