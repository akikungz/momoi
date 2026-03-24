/** Instructor email pattern */
export const instructorEmailRegex = /^[\w-.]+@(itm).kmutnb\.ac\.th$/;
/** Student in IT Department email pattern */
export const studentEmailRegex = /^s\d{2}0602\d{7}@email\.kmutnb\.ac\.th$/;

/** Student ID pattern */
export const studentIdRegex = /\d{2}0602\d{7}$/;

/** Check if the email is an instructor email */
export function isInstructorEmail(email: string) {
	return instructorEmailRegex.test(email);
}

/** Check if the email is a student email */
export function isStudentEmail(email: string) {
	return studentEmailRegex.test(email);
}

/** Extract student ID from email */
export function extractStudentId(email: string) {
	const match = email.match(studentIdRegex);
	return match ? match[0] : null;
}

/** Check email is in IT Department */
export function isItDepartmentEmail(email: string) {
	return isInstructorEmail(email) || isStudentEmail(email);
}
