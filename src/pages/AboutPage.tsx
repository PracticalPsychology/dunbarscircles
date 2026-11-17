import PageLayout from "../components/PageLayout";

export default function AboutPage() {
  return (
    <PageLayout
      title="About & Contact"
      description="Who runs Dunbar's Circles, how to reach us, and how corrections work"
    >
      <div className="mx-auto max-w-3xl space-y-6 text-gray-800 dark:text-gray-100">
        <section aria-labelledby="a-what" className="space-y-2">
          <h2 id="a-what" className="text-xl font-semibold">
            What this site is
          </h2>
          <p>
            Dunbar&apos;s Circles is a free, independent tool that helps you map
            your own relationships onto the layers described in Robin
            Dunbar&apos;s research. It is an educational visualization, not a
            psychological test or clinical advice. It is not affiliated with or
            endorsed by Robin Dunbar or the University of Oxford.
          </p>
        </section>

        <section aria-labelledby="a-lic" className="space-y-2">
          <h2 id="a-lic" className="text-xl font-semibold">
            License and credits
          </h2>
          <p>
            The site code is open source under the MIT License. The research
            belongs to Robin Dunbar and colleagues; see{" "}
            <a className="underline" href="/evidence">
              Evidence &amp; Limitations
            </a>{" "}
            for references. Facebook and LinkedIn are trademarks of their owners
            and are named only to describe import formats.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}
