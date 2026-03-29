# AGENTS.md

## Project goal
This project is a modern minimal landing page for an elevator company.
The primary goal is to build a clean conversion-focused page with a lead form.

## Main feature
At the top of the page there must be a form with fields:
- Name
- Address
- Phone number

## Form requirements
- Name: required text input, min length 2, max length 50
- Address: required text input, min length 5, max length 120
- Phone: required input with Russian mask starting with +79
- Do not allow invalid phone numbers
- Show clear inline validation errors
- The submit button must stay disabled or submission must be blocked until data is valid

## UX requirements
- The page must look modern, minimalistic, and visually appealing
- The design should feel clean and premium, not corporate-heavy
- Mobile-first responsive layout
- Fast loading and simple structure
- Good visual hierarchy above the fold

## Content requirements
- Add temporary placeholder company information below the form
- The content can be mock content for now, but should look realistic

## Engineering rules
- Make minimal, focused changes
- Prefer simple solutions over overengineering
- Do not add heavy dependencies unless clearly needed
- Reuse native HTML validation where appropriate, but provide custom UX on top
- Keep components small and readable

## Done criteria
Before finishing:
- run build
- run lint
- verify the form validation works
- verify phone field accepts only valid Russian-format numbers starting with +79
- verify responsive behavior on mobile and desktop

## Response expectations
When finishing a task:
- briefly list changed files
- explain what was implemented
- explain how to verify manually

## Language requirements
- The entire website must be in Russian
- All UI text (labels, placeholders, buttons, errors) must be in Russian
- All validation messages must be in Russian
- Any placeholder company content must be written in Russian
- Do not mix languages in the UI

Examples:
- Name → Имя
- Address → Адрес
- Phone → Номер телефона
- Submit → Отправить
- Required field → Обязательное поле


## Lead form backend
- The lead form must submit data to a server endpoint, not send email directly from the browser
- Use a backend route for form submission
- Validate all fields on the server before sending
- Send lead notifications to the business email
- Keep provider API keys only on the server
- Return clear success and error states to the frontend

## Email requirements
- Email subject must clearly indicate a new lead
- Email body must include all inputs
- All user-facing messages must remain in Russian

### Done criteria
Before finishing:
- verify successful form submission
- verify invalid data is rejected on the server
- verify duplicate/empty submissions are blocked
- verify success and error messages are shown in Russian