import { ManualViewer } from '@/components/manual-viewer';
import manual from '@/content/manual.json';
function ManualContent({ content, label }: { content: typeof manual.en; label: string }) {
  return (
    <>
      <h1>{content.title}</h1>
      <p className="manual-intro">{content.intro}</p>
      <nav className="manual-toc" aria-label={label}>
        {content.sections.map((section) => (
          <a key={section.id} href={'#' + section.id}>
            {section.title}
          </a>
        ))}
      </nav>
      {content.sections.map((section) => (
        <section className="manual-section" id={section.id} key={section.id}>
          <h2>{section.title}</h2>
          <ol>
            {section.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}

export default function ManualPage() {
  return (
    <ManualViewer
      english={<ManualContent content={manual.en} label="User manual" />}
      chinese={<ManualContent content={manual['zh-CN']} label="用户手册" />}
    />
  );
}
