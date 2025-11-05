# Vocabulary Quiz Application

A modern Angular-based vocabulary learning application designed to help users build and improve their vocabulary through an interactive quiz system. The app features a comprehensive word database, progress tracking, and customizable learning settings.

## Overview

This vocabulary quiz application provides an engaging way to learn new words through multiple-choice questions with real-time feedback. Users can track their progress, review missed words, and customize their learning experience with timer settings and auto-advance options.

## Features

### Core Functionality
- **Interactive Quiz System**: Multiple-choice questions with immediate feedback
- **Word Database**: Comprehensive vocabulary with detailed definitions
- **Progress Tracking**: Visual progress bars for quiz completion and missed words
- **Missed Words Review**: Special quiz mode for reviewing incorrectly answered words

### User Experience
- **Settings Customization**: 
  - Auto-advance timer controls
  - Adjustable timer durations for correct/incorrect answers
  - Personal learning preferences
- **Progress Management**: 
  - Import/export functionality for progress backup
  - Session continuation across browser sessions
- **Responsive Design**: Material Design interface optimized for various screen sizes

### Learning Modes
1. **Main Quiz**: Complete vocabulary quiz with all available words
2. **Review Mode**: Focused practice on previously missed words
3. **Continue Options**: Resume interrupted quizzes or review sessions

## Technology Stack

- **Frontend Framework**: Angular 19.2.5
- **UI Library**: Angular Material Design
- **State Management**: Custom services with RxJS observables
- **Storage**: localStorage for user preferences and progress
- **Build System**: Angular CLI

## Getting Started

### Prerequisites
- Node.js (version compatible with Angular 19.2.5)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/carmex/vocab
cd vocab
```

2. Install dependencies:
```bash
npm install
```

### Development Server

To start a local development server:

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The application will automatically reload when you modify source files.

### Building

To build the project for production:

```bash
ng build --configuration production
```

Build artifacts will be stored in the `dist/` directory.

### Testing

Run unit tests:
```bash
ng test
```

## Project Structure

```
src/
├── app/
│   ├── components/          # Angular components
│   │   ├── main-menu/       # Main navigation menu
│   │   ├── quiz/           # Quiz interface and logic
│   │   ├── settings/       # Application settings
│   │   └── summary/        # Quiz results summary
│   ├── models/             # TypeScript interfaces
│   ├── services/           # Business logic services
│   └── shared-material.module.ts  # Material Design imports
├── assets/
│   └── words.json         # Vocabulary database
└── styles.scss           # Global styles
```

## Key Components

### Quiz Component
- Handles question display and answer selection
- Manages timer logic and auto-advance functionality
- Tracks progress and missed words

### Settings Component
- Provides user customization options
- Manages timer preferences and auto-advance settings
- Persists user preferences in localStorage

### State Service
- Manages application state across components
- Tracks quiz progress and missed words
- Handles import/export functionality

## Word Database

The application includes a comprehensive vocabulary database (`src/assets/words.json`) containing:
- Over 24,000 vocabulary words
- Detailed definitions for each word
- Multiple choice options for quiz questions
- Organized by difficulty and topic categories
## Data Sources & Acknowledgments

The vocabulary database in this project is based on data from the [SAT Words](https://github.com/lrojas94/SAT-Words) repository by [lrojas94](https://github.com/lrojas94). Special thanks to the original contributors for compiling this comprehensive vocabulary resource.

## Customization

### Adding New Words
Extend the vocabulary database by adding new entries to `src/assets/words.json`:

```json
{
  "word": "example",
  "type": "n.",
  "definition": "A thing characteristic of its kind or illustrating a general rule."
}
```

### Styling
Modify `src/styles.scss` and component-specific `.scss` files to customize the appearance.

## Development

### Generating Components
Use Angular CLI to generate new components:

```bash
ng generate component component-name
```

### Code Scaffolding
Generate other Angular artifacts:

```bash
ng generate directive|pipe|service|class|guard|interface|enum|module
```

## License

This project was generated as a vocabulary learning tool. Please refer to the project license for usage terms.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Additional Resources

- [Angular Documentation](https://angular.dev/)
- [Angular Material Design](https://material.angular.io/)
- [Angular CLI Reference](https://angular.dev/tools/cli)
