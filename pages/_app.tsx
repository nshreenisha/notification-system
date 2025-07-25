import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Initialize socket server on app start
    fetch("/api/socket", { method: "POST" })
      .then((res) => res.json())
      .then((data) => console.log("Socket server initialized:", data))
      .catch((err) => console.error("Socket initialization failed:", err));
  }, []);

  return <Component {...pageProps} />;
}
