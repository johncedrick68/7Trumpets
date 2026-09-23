import Link from "next/link";
import { getStoreSetting } from "@/lib/settings/queries";

export async function AnnouncementBar() {
  const announcement = await getStoreSetting("announcement", {
    enabled: true,
    text: "NEW DROP: DROP 01 NOW AVAILABLE — COMPLIMENTARY METRO MANILA SHIPPING OVER ₱3,500",
    link: "/products",
  });

  if (!announcement.enabled || !announcement.text) {
    return null;
  }

  return (
    <div className="announcement-bar" role="region" aria-label="Announcement">
      {announcement.link ? (
        <Link href={announcement.link} className="hover:underline transition-all">
          <span>{announcement.text}</span>
        </Link>
      ) : (
        <span>{announcement.text}</span>
      )}
    </div>
  );
}
