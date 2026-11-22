import type { Metadata } from "next";
import { Archivo, Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });
const heading = Archivo({ variable: "--font-heading", subsets: ["latin"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Good Morning Indian", template: "%s · Good Morning Indian" },
  description: "World, business and culture news, reported with care.",
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${heading.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body id="top" suppressHydrationWarning>
        {/* Set the theme before paint to avoid a flash of the wrong colours. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.theme="light"}',
          }}
        />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main" className="container main">
          {children}
        </main>
        <Footer />
        {modal}
      </body>
    </html>
  );
}
