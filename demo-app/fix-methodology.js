import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const buildDir = join(process.cwd(), 'build');
const methodologyFile = join(buildDir, 'methodology.html');

try {
    let content = readFileSync(methodologyFile, 'utf-8');
    
    // Fix base path - replace dynamic calculation with hardcoded base
    content = content.replace(
        /base:\s*new URL\("\.",\s*location\)\.pathname\.slice\(0,\s*-1\)/g,
        'base: "/deals-and-lawsuits-tracker"'
    );
    
    // Fix relative modulepreload links to absolute paths
    content = content.replace(
        /href="\.\/_app\//g,
        'href="/deals-and-lawsuits-tracker/_app/'
    );
    
    // Fix relative import statements to absolute paths
    content = content.replace(
        /import\("\.\/_app\//g,
        'import("/deals-and-lawsuits-tracker/_app/'
    );
    
    writeFileSync(methodologyFile, content, 'utf-8');
    console.log('✓ Fixed methodology.html base path and asset paths');
} catch (error) {
    console.error('Error fixing methodology.html:', error);
    process.exit(1);
}
