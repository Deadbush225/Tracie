import { initializeApp } from "firebase/app";
import {
	getAuth,
	signInWithPopup,
	GoogleAuthProvider,
	signOut,
	onAuthStateChanged,
} from "firebase/auth";
import {
	getFirestore,
	collection,
	doc,
	setDoc,
	getDoc,
	getDocs,
	deleteDoc,
	query,
	orderBy,
} from "firebase/firestore";
import { writable, get } from "svelte/store";

// Firebase config — prefer Vite environment variables (VITE_*) so secrets stay off-source.
// Create a local file named `.env.local` (or set env vars in your host/CI) with the keys below.
// Vite exposes env vars via `import.meta.env` for client-side code. Prefix your variables with VITE_.
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Auth state store
export const user = writable(null);
export const authLoading = writable(true);

// Listen to auth state changes
onAuthStateChanged(auth, (firebaseUser) => {
	user.set(firebaseUser);
	authLoading.set(false);
});

// Sign in with Google
export async function signInWithGoogle() {
	const provider = new GoogleAuthProvider();
	try {
		const result = await signInWithPopup(auth, provider);
		return result.user;
	} catch (error) {
		// Log structured error information to make diagnosis easier in the browser console
		// Common failure: auth/configuration-not-found when Google sign-in isn't enabled
		console.error("Error signing in:", {
			code: error.code,
			message: error.message,
			stack: error.stack,
			error,
		});

		// Helpful guidance for a common configuration error
		if (error && error.code === "auth/configuration-not-found") {
			console.error(
				"Firebase Auth configuration not found. Common fixes:\n" +
					"1) In the Firebase Console, go to Authentication > Sign-in method and enable 'Google' provider.\n" +
					"2) Ensure your app's domain (e.g. localhost, your dev hostname) is listed under Authorized domains.\n" +
					"3) Verify the firebaseConfig in src/firebase.js matches the web app credentials in Firebase Console (apiKey, authDomain, projectId, appId).\n" +
					"4) If using multiple projects, ensure you're initializing the intended project.\n" +
					"After making changes, retry sign-in."
			);
		}
		throw error;
	}
}

// Sign out
export async function signOutUser() {
	try {
		await signOut(auth);
	} catch (error) {
		console.error("Error signing out:", error);
		throw error;
	}
}

// File operations
export async function saveFile(userId, filename, data) {
	if (!userId) throw new Error("User not authenticated");

	const fileRef = doc(db, `users/${userId}/files`, filename);
	await setDoc(fileRef, {
		...data,
		updatedAt: new Date().toISOString(),
		createdAt: data.createdAt || new Date().toISOString(),
	});
}

export async function loadFile(userId, filename) {
	if (!userId) throw new Error("User not authenticated");

	const fileRef = doc(db, `users/${userId}/files`, filename);
	const docSnap = await getDoc(fileRef);

	if (docSnap.exists()) {
		return docSnap.data();
	} else {
		throw new Error("File not found");
	}
}

export async function listFiles(userId) {
	if (!userId) throw new Error("User not authenticated");

	const filesRef = collection(db, `users/${userId}/files`);
	const q = query(filesRef, orderBy("updatedAt", "desc"));
	const querySnapshot = await getDocs(q);

	const files = [];
	querySnapshot.forEach((doc) => {
		files.push({
			name: doc.id,
			...doc.data(),
		});
	});

	return files;
}

export async function deleteFile(userId, filename) {
	if (!userId) throw new Error("User not authenticated");

	const fileRef = doc(db, `users/${userId}/files`, filename);
	await deleteDoc(fileRef);
}
