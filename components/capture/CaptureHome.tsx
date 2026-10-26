"use client";

import Link from "next/link";

export default function CaptureHome() {
  return (
    <div className="capture-home">
      <h1>To do</h1>
      <Link href="/today">Open app →</Link>
    </div>
  );
}
