import { getSiteData } from "@/lib/content";
import Nav from "@/components/site/Nav";
import PackBuilder from "@/components/site/PackBuilder";
import Hero from "@/components/site/Hero";
import Rhythm from "@/components/site/Rhythm";
import Bios from "@/components/site/Bios";
import Faq from "@/components/site/Faq";
import EventsForm from "@/components/site/EventsForm";
import Footer from "@/components/site/Footer";

export const revalidate = 60;

export default async function Home() {
  const data = await getSiteData();
  return (
    <main>
      <Nav />
      <Hero hero={data.hero} images={data.images} settings={data.settings} />
      <Rhythm settings={data.settings} />
      <PackBuilder dishes={data.dishes} settings={data.settings} />
      <Bios images={data.images} />
      <EventsForm />
      <Faq faq={data.faq} />
      <Footer />
    </main>
  );
}
