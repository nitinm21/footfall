// middleware.example.ts — copy this to your site's `middleware.ts`.
// If you already HAVE a middleware.ts, instead wrap your existing function:
//   export default withFootfall(myExistingMiddleware)

import { withFootfall } from "./footfall";

export default withFootfall();

// Capture pages AND static assets (asset ratio is a top classifier signal);
// skip only Next's image optimizer + favicon. Adjust to taste.
export const config = {
  matcher: ["/((?!_next/image|favicon.ico).*)"],
};
