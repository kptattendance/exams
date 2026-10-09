"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import axios from "axios";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";
import FullPageStatus from "../components/shell/FullPageStatus";

export default function AdminLayout({ children }) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const token = await getToken();

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const user = response.data?.data;

        if (user?.role !== "admin") {
          router.replace("/");
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error("Admin verification failed:", error);
        router.replace("/");
      }
    };

    verifyAdmin();
  }, [getToken, router]);

  if (loading) {
    return <FullPageStatus message="Checking your administrator access…" />;
  }

  return <AppShell menu={MENUS.admin}>{children}</AppShell>;
}