import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import SiteNotFound from "./(site)/not-found";

// Unmatched URLs render outside the (site) layout, so add the site chrome here.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <SiteNotFound />
      </main>
      <SiteFooter />
    </>
  );
}
