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
  title: { default: "1968 Clothing — Filipino Streetwear", template: "%s | 1968 Clothing" },
  description: "Independent Filipino streetwear · Est. 1968. Archival pieces shaped by community, heritage, and the streets.",
  applicationName: "1968 Clothing",
  keywords: ["streetwear", "Filipino fashion", "1968 clothing", "Manila"],
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/favicon.png", type: "image/png" }], apple: "/apple-touch-icon.png" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Global chrome must not make every route depend on catalog availability.
  // Catalog pages fetch live categories themselves; the footer has resilient
  // canonical links so auth and system pages remain usable during DB outages.
  const footer = await getStoreSetting("footer", { brand_copy: "Independent Filipino streetwear · Est. 1968. Archival garments crafted for the daily journey.", support_email: "1968clothing.official@gmail.com", location: "Manila, Philippines" });
  return <html lang="en" data-scroll-behavior="smooth"><body className={sfProDisplay.variable}>
    <StorefrontChrome announcement={<AnnouncementBar />} cartBadge={<CartBadge />} footer={footer}>{children}</StorefrontChrome>
  </body></html>;
}
