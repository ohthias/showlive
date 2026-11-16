import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "@fontsource-variable/roboto";
import "@fontsource-variable/roboto/wght-italic.css";
import "@fontsource-variable/roboto-mono";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { themeBootScript } from "@/components/ui/ThemeController";

const SITE = process.env.NEXT_PUBLIC_SHOWLIVE_URL ?? "https://showlive.robostage.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "ShowLive · RoboStage", template: "%s · ShowLive" },
  description:
    "Ranking ao vivo, mesa de arbitragem e telão para torneios de robótica. Crie o evento com sua conta RoboStage e compartilhe os códigos.",
  icons: { icon: "/images/icon.png" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ShowLive · RoboStage",
    title: "ShowLive — seu evento de robótica, ao vivo.",
    description: "Ranking em tempo real, mesa dos juízes e telão para FLL, OBR Resgate e desafios próprios.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcf8" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1c18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh bg-base-100 font-sans text-base-content antialiased">
        <ClerkProvider localization={ptBR}>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
