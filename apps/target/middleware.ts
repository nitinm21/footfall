import { withFootfall } from "@footfall/next";

// Observe-only Footfall capture. Inert unless FOOTFALL_TOKEN + FOOTFALL_INGEST_URL
// are set, so the rig behaves normally for Phase-1 proxy capture by default.
export default withFootfall();

// Capture pages AND static assets (asset ratio is a top classifier feature);
// skip only Next's image optimizer and the favicon.
export const config = {
  matcher: ["/((?!_next/image|favicon.ico).*)"],
};
