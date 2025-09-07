# GitHub Pages Documentation

This folder contains the source files for the GitHub Pages site of the IBM Salesforce Context project.

## Structure

- `index.html` - Main landing page with project overview and features
- `_config.yml` - Jekyll configuration for GitHub Pages
- `_layouts/` - Jekyll layout templates
- `README.md` - This file

## GitHub Pages Setup

The site is automatically deployed using GitHub Actions when changes are pushed to the main branch.

### Configuration

1. **Repository Settings**: Enable GitHub Pages in your repository settings
2. **Source**: Set the source to "GitHub Actions" (not "Deploy from a branch")
3. **Custom Domain**: Optionally configure a custom domain if desired

### Deployment

The deployment is handled by the `.github/workflows/deploy-gh-pages.yml` workflow which:
- Triggers on pushes to main branch
- Builds the site from the `docs/` folder
- Deploys to GitHub Pages automatically

### Local Development

To test the site locally:

1. Install Jekyll: `gem install jekyll bundler`
2. Navigate to the `docs/` folder
3. Run: `jekyll serve`
4. Open `http://localhost:4000` in your browser

## Customization

- **Styling**: Modify the CSS in `index.html`
- **Content**: Update the HTML content in `index.html`
- **Configuration**: Adjust `_config.yml` for Jekyll settings
- **Layouts**: Modify files in `_layouts/` folder

## Notes

- The site uses static HTML with embedded CSS for simplicity
- Jekyll is configured for GitHub Pages compatibility
- All assets are referenced from the main project structure
- The site is responsive and mobile-friendly
