/**
 * Sign-in page using Clerk
 */

import { SignIn } from '@clerk/nextjs';

export default function SignInPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <SignIn />
    </div>
  );
}

