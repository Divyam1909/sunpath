import { Geist, Noto_Sans_Devanagari } from "next/font/google";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"] });

export const fontClasses = `${geist.variable} ${devanagari.variable}`;
