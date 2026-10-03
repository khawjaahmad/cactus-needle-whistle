/** The example test cases the editor offers, written the way a tester writes a manual case. */

const SIGN_IN = 'Sign in as admin@acme.com with password Passw0rd!';

export interface Example {
  name: string;
  steps: string[];
}

export const EXAMPLES: Example[] = [
  {
    name: 'Sign in reaches the dashboard',
    steps: [SIGN_IN, 'User should be redirected to the dashboard', 'Confirm "Welcome back, Admin" appears'],
  },
  {
    name: 'Wrong password is rejected',
    steps: [
      'Log in with admin@acme.com and wrongpass',
      'An error "Invalid email or password" should be displayed',
      'Verify we are still on the login page',
    ],
  },
  {
    name: 'Invite a new editor',
    steps: [
      SIGN_IN,
      'Invite dana@acme.com as an editor',
      'Confirm "Invitation sent" appears',
      'Verify dana@acme.com is pending',
    ],
  },
  {
    name: 'Remove a user',
    steps: [SIGN_IN, 'Remove bob@acme.com', 'Verify bob@acme.com is removed'],
  },
  {
    name: 'Turn off two-factor',
    steps: [
      SIGN_IN,
      'Turn off two-factor authentication',
      'Confirm "Settings saved" appears',
      'Verify two-factor is off',
    ],
  },
  {
    name: 'Settings need a signed-in user',
    steps: ['Open settings', 'Verify we are still on the login page'],
  },
];
