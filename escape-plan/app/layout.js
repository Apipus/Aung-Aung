import "./globals.css";
import { Nunito, Holtwood_One_SC } from "next/font/google";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

const holtwood = Holtwood_One_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-holtwood",
});

export const metadata = {
  title: "Escape Plan",
  description: "Multiplayer Run For It! Game",
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`
          ${nunito.variable} 
          ${holtwood.variable} 
          antialiased font-nunito
        `}
      >
        {children}
      </body>
    </html>
  );
}
