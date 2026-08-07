/**
 * Seed marketplace metadata on existing courses for production.
 * Run: node scripts/seed-marketplace-prod.js
 * This updates existing courses with marketplace data (thumbnails, pricing, etc.)
 */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log("Updating marketplace metadata on existing courses...\n");

  // Update all courses that are published but have no subtitle/thumbnail
  const courses = await db.course.findMany({
    where: { published: true },
    select: { id: true, name: true, subtitle: true, thumbnailUrl: true, category: true }
  });

  for (const course of courses) {
    if (course.subtitle) continue; // already has marketplace data

    // Determine category from course name
    let category = "technology";
    let subtitle = "Professional training program";
    let thumbnailQuery = "education,training,professional";
    let price = 199;

    if (course.name.toLowerCase().includes("ebay") || course.name.toLowerCase().includes("ecommerce")) {
      category = "business";
      subtitle = "Master eBay selling — from product listing to scaling your store";
      thumbnailQuery = "ebay,ecommerce,selling";
      price = 199;
    } else if (course.name.toLowerCase().includes("web") || course.name.toLowerCase().includes("dev")) {
      category = "technology";
      subtitle = "From zero to full-stack developer in 6 weeks";
      thumbnailQuery = "web-development,coding,programming";
      price = 299;
    } else if (course.name.toLowerCase().includes("python") || course.name.toLowerCase().includes("data")) {
      category = "data";
      subtitle = "Master data pipelines, ETL, and analytics";
      thumbnailQuery = "python,data,analytics";
      price = 249;
    } else if (course.name.toLowerCase().includes("devops") || course.name.toLowerCase().includes("cloud")) {
      category = "technology";
      subtitle = "Docker, CI/CD, and cloud deployment essentials";
      thumbnailQuery = "devops,cloud,servers";
      price = 349;
    } else if (course.name.toLowerCase().includes("safety") || course.name.toLowerCase().includes("compliance")) {
      category = "compliance";
      subtitle = "Industry-standard safety certification preparation";
      thumbnailQuery = "safety,industrial,workplace";
      price = 199;
    }

    await db.course.update({
      where: { id: course.id },
      data: {
        subtitle,
        category,
        price,
        currency: "USD",
        durationWeeks: 6,
        language: "en",
        thumbnailUrl: `https://picsum.photos/seed/${thumbnailQuery}&sig=${course.id.charCodeAt(0)}`,/600/400
        instructorName: "FCCL Training Team",
        instructorBio: "Professional trainers with industry experience in their respective domains.",
        whatYouWillLearn: JSON.stringify([
          "Master the core concepts and practical skills",
          "Apply knowledge through hands-on projects",
          "Earn a verified digital credential",
          "Build a portfolio-ready capstone project"
        ]),
        prerequisites: JSON.stringify([
          "Basic computer literacy",
          "A laptop with internet connection"
        ]),
        skillsVerified: JSON.stringify([
          "Domain Expertise", "Practical Application", "Project Execution"
        ]),
      },
    });
    console.log(`  ✓ Updated: ${course.name}`);
  }

  console.log("\n✅ Marketplace metadata update complete!");
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
