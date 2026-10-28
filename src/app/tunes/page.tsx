import type { Metadata } from "next";
import TunePicker from "@/components/TunePicker";

export const metadata: Metadata = {
  title: "Pick the music",
  description: "Preview the tunes the birthday page's music box can play.",
  // A private helper page for choosing the music, not something to show up in search.
  robots: { index: false, follow: false },
};

export default function TunesPage() {
  return <TunePicker />;
}
