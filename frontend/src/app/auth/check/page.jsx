"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthCheckPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();

  const router = useRouter();

  const [message, setMessage] = useState(
    "Verifying your account..."
  );

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace("/");
      return;
    }

    const verifyUser = async () => {
      try {
        setMessage("Verifying your college account...");

        const token = await getToken();

        if (!token) {
          throw new Error(
            "Unable to obtain authentication token."
          );
        }

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const user = response.data?.data;

        if (!user) {
          throw new Error(
            "User information not found."
          );
        }

        console.log("Verified user:", user);
        console.log("Role:", user.role);

        // ==========================================
        // ROLE BASED REDIRECTION
        // ==========================================
switch (user.role) {
  case "admin":
    router.replace("/admin");
    break;

  case "principal":
    router.replace("/principal");
    break;

  case "hod":
    router.replace("/hod");
    break;

 case "coe":
    router.replace("/coe");
    break;

case "exam_officer":
    router.replace("/exam_officer");
    break;

  case "staff":
    router.replace("/faculty");
    break;

  case "student":
    router.replace("/student");
    break;

  default:
    setMessage("Your account has an invalid role.");
    await signOut();
    setTimeout(() => router.replace("/"), 1500);
}
      } catch (error) {
        console.error(
          "Authentication verification failed:",
          error
        );

        if (error.response?.status === 404) {
          setMessage(
            "Your Clerk account exists, but you are not registered in the college system."
          );
        } else if (error.response?.status === 401) {
          setMessage(
            "Authentication failed. Please sign in again."
          );
        } else {
          setMessage(
            "Unable to verify your account. Please try again."
          );
        }

        await signOut();

        setTimeout(() => {
          router.replace("/");
        }, 2000);
      }
    };

    verifyUser();
  }, [
    isLoaded,
    isSignedIn,
    getToken,
    signOut,
    router,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">

        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

        <h1 className="text-xl font-semibold">
          Account Verification
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          {message}
        </p>

      </div>
    </div>
  );
}