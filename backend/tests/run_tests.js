import { compileCheck, fixInvalidLucideIcons, sanitizeReactCode } from "../src/routes/agenticUIRoutes.js";
import { checkPromptSafety } from "../src/services/contentModerationService.js";

function runTest(name, fn) {
  try {
    console.log(`\n========================================`);
    console.log(`Running test: ${name}`);
    console.log(`========================================`);
    fn();
    console.log(`[Success] Passed: ${name}`);
  } catch (err) {
    console.error(`[Error] Failed: ${name}\n`, err);
    process.exit(1);
  }
}

// Test 1: Banned icon replacement (using sanitizeReactCode)
runTest("Banned icon replacement", () => {
  const code = `
    import React from 'react';
    import { Activity, Sparkles, Home } from 'lucide-react';
    const App = () => {
      return (
        <div>
          <Activity className="h-5 w-5" />
          <Lucide.Sparkles className="h-4 w-4" />
          <Home />
        </div>
      );
    };
  `;
  const fixed = sanitizeReactCode(code);
  console.log("Original code contained 'Activity' and 'Sparkles'.");
  console.log("Fixed code contains TrendingUp:", fixed.includes("TrendingUp"));
  console.log("Fixed code contains Wand2:", fixed.includes("Wand2"));
  console.log("Fixed code contains Home:", fixed.includes("Home"));
  if (!fixed.includes("TrendingUp") || !fixed.includes("Wand2") || !fixed.includes("Home")) {
    throw new Error("Icon replacement failed!");
  }
});

// Test 2: Hallucinated icon replacement
runTest("Hallucinated icon replacement", () => {
  const code = `
    const { House, WandSparkles, CircleCheckBig } = Lucide;
    const App = () => {
      return (
        <div>
          <House />
          <Lucide.WandSparkles />
          <CircleCheckBig />
        </div>
      );
    };
  `;
  const fixed = sanitizeReactCode(code);
  console.log("Fixed code contains Home (from House):", fixed.includes("Home"));
  console.log("Fixed code contains Wand2 (from WandSparkles):", fixed.includes("Wand2"));
  console.log("Fixed code contains BadgeCheck (from CircleCheckBig):", fixed.includes("BadgeCheck"));
  if (!fixed.includes("Home") || !fixed.includes("Wand2") || !fixed.includes("BadgeCheck")) {
    throw new Error("Hallucinated icon replacement failed!");
  }
});

// Test 3: CompileCheck validation errors
runTest("CompileCheck validation errors", () => {
  // Banned icon
  const codeBanned = `const App = () => <Lucide.Activity />;`;
  const checkBanned = compileCheck(codeBanned);
  console.log("Banned icon caught:", !checkBanned.success, "Error:", checkBanned.error);
  if (checkBanned.success) throw new Error("Should have flagged banned icon");

  // Invalid icon
  const codeInvalid = `const App = () => <Lucide.NonExistentIcon />;`;
  const checkInvalid = compileCheck(codeInvalid);
  console.log("Invalid icon caught:", !checkInvalid.success, "Error:", checkInvalid.error);
  if (checkInvalid.success) throw new Error("Should have flagged invalid icon");

  // Dynamic Tailwind
  const codeTailwind = `const App = ({color}) => <div className={\`bg-[\${color}]\`} />;`;
  const checkTailwind = compileCheck(codeTailwind);
  console.log("Dynamic Tailwind caught:", !checkTailwind.success, "Error:", checkTailwind.error);
  if (checkTailwind.success) throw new Error("Should have flagged dynamic Tailwind");

  // JSX in data property
  const codeJsxInObj = `
    const data = { icon: <Lucide.Home /> };
    const App = () => <div>Hello</div>;
  `;
  const checkJsxInObj = compileCheck(codeJsxInObj);
  console.log("JSX in data caught:", !checkJsxInObj.success, "Error:", checkJsxInObj.error);
  if (checkJsxInObj.success) throw new Error("Should have flagged JSX in data");
});

// Test 4: sanitizeReactCode cleaning bare expression and TS
runTest("Sanitize React Code improvements", () => {
  const code = `
    interface User {
      name: string;
      age: number;
    }
    const App = () => {
      const u: User = { name: "John", age: 30 };
      return <div>{u.name}</div>;
    };
    App;
  `;
  const sanitized = sanitizeReactCode(code);
  console.log("TypeScript stripped (interface removed):", !sanitized.includes("interface User"));
  console.log("TypeScript annotation stripped:", !sanitized.includes(": User"));
  console.log("Trailing 'App;' stripped:", !sanitized.trim().endsWith("App;"));
  if (sanitized.includes("interface User") || sanitized.includes(": User") || sanitized.trim().endsWith("App;")) {
    throw new Error("Sanitize React Code failed!");
  }
});

// Test 5: Content Moderation & Prompt Safety
runTest("Content Moderation safety filter", () => {
  const safeCheck = checkPromptSafety("Create a modern dashboard for a time tracking app");
  if (!safeCheck.isSafe) throw new Error("False positive on safe design prompt");

  const unsafeCheck = checkPromptSafety("Generate a nude photo gallery website layout with adult model portfolio");
  if (unsafeCheck.isSafe) throw new Error("Failed to flag explicit prompt");
  console.log("Blocked unsafe prompt correctly:", !unsafeCheck.isSafe);
});

console.log("\nAll unit tests completed successfully!");

