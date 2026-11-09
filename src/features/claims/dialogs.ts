/**
 * Separate entry point so the dialogs (and zod, used for form validation) are code-split and
 * only downloaded the first time a user opens Edit / Assign / Delete.
 */
export { ClaimDialogs as default } from './components/ClaimDialogs';
