import { Widget } from "@/components/Widget";

export default function Home() {
  return (
    <main className="flex-1 bg-white px-6 py-6">
      <div className="flex flex-wrap gap-4">
        <Widget name="GPA Calc" href="/gpa-calc" />
        <Widget name="Example" href="/example" />
        <Widget name="Syllabus Tracker" href="/syllabus-tracker" />
      </div>
    </main>
  );
}
