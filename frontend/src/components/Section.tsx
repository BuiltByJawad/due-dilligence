import { ReactNode } from "react";

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function Section({ title, description, children, className }: SectionProps) {
  const sectionClassName = [
    "mb-6 rounded-[20px] border border-[#e4ded6] bg-white/90 p-6",
    "shadow-[0_24px_60px_-40px_rgba(15,19,26,0.3)] backdrop-blur",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#101419]">{title}</h2>
          {description && <p className="text-sm text-[#4b4f53]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
