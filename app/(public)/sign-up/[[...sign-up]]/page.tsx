/**
 * Sign-up page using Clerk
 */

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <SignUp />
    </div>
  );
}

