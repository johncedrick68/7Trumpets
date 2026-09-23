import Link from "next/link";
import { getStoreSetting } from "@/lib/settings/queries";

export async function AnnouncementBar() {
  const announcement = await getStoreSetting("announcement", {
    enabled: true,
    text: "COD AND MANUAL GCASH AVAILABLE",
    link: "/products",
  });

  if (!announcement.enabled || !announcement.text) {
    return null;
  }

  const text = /metro manila|free shipping|complimentary shipping/i.test(announcement.text)
    ? "COD AND MANUAL GCASH AVAILABLE"
    : announcement.text;

  return (
    <div className="announcement-bar" role="region" aria-label="Announcement">
      {announcement.link ? (
        <Link href={announcement.link} className="hover:underline transition-all">
          <span>{text}</span>
        </Link>
      ) : (
        <span>{text}</span>
      )}
    </div>
  );
}
