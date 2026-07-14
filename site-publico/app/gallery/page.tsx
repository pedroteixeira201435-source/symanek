import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Life and learning at Symanek Specialized College.",
};

const photos = Array.from({ length: 8 }, (_, i) => `/images/gallery/g${i + 1}.jpg`);

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="Life at Symanek"
        subtitle="Practical training, dedicated facilitators and a supportive learning environment."
      />
      <div className="container-max py-16">
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {photos.map((src, i) => (
            <Reveal key={src} delay={(i % 4) * 50}>
              <div className="overflow-hidden rounded-2xl ring-1 ring-petrol-100">
                <Image
                  src={src}
                  alt={`Symanek gallery photo ${i + 1}`}
                  width={600}
                  height={800}
                  className="h-auto w-full object-cover transition-transform duration-500 ease-out-strong hover:scale-[1.03]"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}
