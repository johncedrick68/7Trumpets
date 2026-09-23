import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AnnouncementBar } from "@/components/announcement-bar";
import { CartBadge } from "@/components/cart-badge";
import { StorefrontChrome } from "@/components/storefront-chrome";
import { getStoreSetting } from "@/lib/settings/queries";

const sfProDisplay = localFont({
  src: [
    { path: "../fonts/sfprodisplayregular.otf", weight: "400", style: "normal" },
    { path: "../fonts/sfprodisplaymedium.otf", weight: "500", style: "normal" },
    { path: "../fonts/sfprodisplaybold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-sf-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "1968 Clothing — Official Store", template: "%s | 1968 Clothing" },
  description: "Shop the current 1968 Clothing collection. View product availability, choose your size, and order online.",
  applicationName: "1968 Clothing",
  keywords: ["streetwear", "clothing", "1968 clothing"],
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/favicon.png", type: "image/png" }], apple: "/apple-touch-icon.png" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Global chrome must not make every route depend on catalog availability.
  // Catalog pages fetch live categories themselves; the footer has resilient
  // canonical links so auth and system pages remain usable during DB outages.
  const footer = await getStoreSetting("footer", { brand_copy: "Independent clothing made for everyday wear.", support_email: "1968clothing.official@gmail.com" });
  return <html lang="en" data-scroll-behavior="smooth"><body className={sfProDisplay.variable}>
    <StorefrontChrome announcement={<AnnouncementBar />} cartBadge={<CartBadge />} footer={footer}>{children}</StorefrontChrome>
  </body></html>;
}
