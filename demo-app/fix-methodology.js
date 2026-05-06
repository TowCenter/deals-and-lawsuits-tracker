import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const buildDir = join(process.cwd(), 'build');
const methodologyFile = join(buildDir, 'methodology.html');

try {
    let content = readFileSync(methodologyFile, 'utf-8');
    
    // Fix base path - replace dynamic calculation with hardcoded base
    content = content.replace(
        /base:\s*new URL\("\.",\s*location\)\.pathname\.slice\(0,\s*-1\)/g,
        'base: "/ai-deals-lawsuits"'
    );
    
    // Fix relative modulepreload links to absolute paths
    content = content.replace(
        /href="\.\/_app\//g,
        'href="/ai-deals-lawsuits/_app/'
    );
    
    // Fix relative import statements to absolute paths
    content = content.replace(
        /import\("\.\/_app\//g,
        'import("/ai-deals-lawsuits/_app/'
    );
    
    writeFileSync(methodologyFile, content, 'utf-8');
    console.log('✓ Fixed methodology.html base path and asset paths');
} catch (error) {
    console.error('Error fixing methodology.html:', error);
    process.exit(1);
}
