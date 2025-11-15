# Data Preparation Guide for S-RAG

This guide explains how to prepare your documents and questions for optimal S-RAG ingestion and query performance.

---

## Table of Contents

1. [Overview](#overview)
2. [Document Preparation](#document-preparation)
3. [Question Preparation](#question-preparation)
4. [File Formats](#file-formats)
5. [Best Practices](#best-practices)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## Overview

S-RAG works by:
1. **Predicting a schema** from sample documents and questions
2. **Extracting structured records** from all documents
3. **Answering aggregative queries** using SQL over the structured data

To get the best results, your documents should:
- Share common attributes (recurring concepts)
- Contain factual, structured information
- Be relatively consistent in format
- Include numerical data for aggregative queries

---

## Document Preparation

### Supported Formats

S-RAG can process documents in various formats:

- **Plain Text** (.txt)
- **Markdown** (.md)
- **HTML**
- **JSON** (as text content)

The LLM extracts structured information regardless of the format, but simpler formats often work better.

### Document Structure

#### ✅ Good Document Examples

**Example 1: Product Information**
```text
Product: Wireless Headphones XZ-100

Price: $149.99
Brand: TechAudio
Release Date: January 2023
Battery Life: 30 hours
Noise Cancellation: Active
Weight: 250 grams
Color Options: Black, Silver, Blue
Customer Rating: 4.5 stars (based on 1,200 reviews)
Wireless Range: 10 meters
Water Resistance: IPX4
```

**Why this works:**
- Clear attribute-value pairs
- Consistent formatting
- Mix of numerical and categorical data
- Factual information

**Example 2: Company Information**
```markdown
# Acme Corporation

**Founded:** 2015
**Headquarters:** San Francisco, CA
**Industry:** Software
**Employees:** 450
**Annual Revenue:** $50M
**CEO:** Jane Smith
**Public/Private:** Private
**Funding Raised:** $75M
**Main Products:** Cloud storage, Analytics platform
```

**Why this works:**
- Structured markdown format
- Clear labels for each field
- Numerical data for aggregations
- Categorical information for filtering

#### ❌ Poor Document Examples

**Example 1: Narrative Style**
```text
I recently purchased the Wireless Headphones XZ-100 and have been using them
for about two weeks. The sound quality is excellent, though I wish they were
a bit lighter. My friend also has a pair and loves them. The price seemed
reasonable compared to other brands I looked at.
```

**Why this doesn't work well:**
- Lacks clear attribute-value structure
- Contains opinions and subjective information
- Missing concrete numerical data
- Inconsistent information across documents

**Example 2: Too Sparse**
```text
Product: Wireless Headphones XZ-100
Great headphones!
```

**Why this doesn't work well:**
- Too little information
- No structured attributes
- Can't extract useful data

### Document Size

**Optimal Size:**
- **Minimum:** 100-200 words per document
- **Optimal:** 200-500 words per document
- **Maximum:** 2000-3000 words per document

**Tips:**
- Longer documents take more time to process
- Very short documents may not contain enough information
- Break very long documents into logical sections if possible

### Consistency Across Documents

Documents in your corpus should share common attributes:

**✅ Good (Consistent Schema):**
```text
Doc 1: Hotel A - Rating: 4.5, Price: $200, Rooms: 50
Doc 2: Hotel B - Rating: 3.8, Price: $150, Rooms: 30
Doc 3: Hotel C - Rating: 4.9, Price: $350, Rooms: 100
```

**❌ Poor (Inconsistent Schema):**
```text
Doc 1: Hotel A - Rating: 4.5, Price: $200, Rooms: 50
Doc 2: Restaurant B - Cuisine: Italian, Capacity: 80
Doc 3: Event C - Date: May 15, Attendance: 500
```

If you have multiple entity types, consider:
- Running separate ingestion pipelines for each type
- Ensuring documents about the same entity type are in one corpus

---

## Question Preparation

### Purpose of Sample Questions

Sample questions help S-RAG:
- **Refine the schema** to include attributes needed for queries
- **Understand query patterns** you'll be asking
- **Optimize for aggregative queries**

### Question Types

#### ✅ Good Questions (Aggregative)

**Counting:**
```
How many hotels have a rating above 4.0?
How many products were released in 2023?
```

**Averaging:**
```
What is the average price of all products?
What is the mean customer rating?
```

**Filtering with Aggregation:**
```
What is the average revenue for companies with more than 100 employees?
How many hotels in New York have parking?
```

**Min/Max:**
```
Which product has the highest price?
What is the minimum battery life across all devices?
```

**Grouping:**
```
What is the average price per product category?
How many employees per company size (small/medium/large)?
```

#### ❌ Less Suitable Questions

**Simple Lookups (better for traditional RAG):**
```
What is the name of the CEO of Acme Corporation?
What color is product XZ-100?
```

**Why:** These don't require aggregation and can be answered by retrieving a single document.

**Questions Requiring External Knowledge:**
```
How does this compare to industry standards?
Is this a good value?
```

**Why:** S-RAG works with only the information in your documents.

### Number of Sample Questions

**Recommended:**
- **Minimum:** 5 questions
- **Optimal:** 10-15 questions
- **Maximum:** 20 questions

**Tips:**
- More questions help refine the schema
- Questions should cover different types of queries you'll ask
- Include questions about different attributes

### Question Format

Questions should be:
- **Natural language** (not SQL)
- **Specific** to your domain
- **Answerable** from the documents
- **Aggregative** when possible

**Example Set for Hotels:**
```text
1. What is the average room price across all hotels?
2. How many hotels offer free WiFi?
3. Which hotel has the most rooms?
4. What is the average rating for 5-star hotels?
5. How many hotels are located in Paris?
6. What is the price range for hotels with pools?
7. Which hotels allow pets?
8. What is the total capacity (all rooms) across all properties?
9. How many hotels were built after 2010?
10. What is the average distance to airport for city center hotels?
```

---

## File Formats

### Documents File Format

#### Option 1: JSON Array

```json
[
  "Document 1 content here...",
  "Document 2 content here...",
  "Document 3 content here..."
]
```

#### Option 2: Text File (One Document per Line)

```text
Document 1 content here...
Document 2 content here...
Document 3 content here...
```

#### Option 3: Text File (Separator-Based)

```text
---DOCUMENT---
Document 1 content here...
---DOCUMENT---
Document 2 content here...
---DOCUMENT---
Document 3 content here...
```

### Questions File Format

#### Option 1: JSON Array

```json
[
  "Question 1?",
  "Question 2?",
  "Question 3?"
]
```

#### Option 2: Text File (One Question per Line)

```text
Question 1?
Question 2?
Question 3?
```

### File Naming

**Recommended Structure:**
```
data/
├── my-corpus/
│   ├── documents.json          # All documents
│   ├── questions.txt            # Sample questions
│   └── schema.json              # Optional: pre-defined schema
```

---

## Best Practices

### 1. Start Small, Iterate

**Process:**
1. Start with 10-20 sample documents
2. Prepare 5-10 sample questions
3. Run ingestion and inspect the generated schema
4. Refine questions if needed
5. Scale up to full corpus

### 2. Include Representative Samples

Ensure sample documents include:
- All major attributes you want to query
- Edge cases (min/max values)
- Different formats/styles if corpus is heterogeneous
- Both common and rare attribute values

### 3. Use Descriptive Labels

**✅ Good:**
```text
Annual Revenue: $5M
Number of Employees: 150
Headquarters Location: Boston, MA
```

**❌ Unclear:**
```text
Revenue: 5M
Staff: 150
Location: Boston
```

Clear labels help the LLM extract accurate values.

### 4. Normalize Units

**Consistent:**
```text
Doc 1: Price: $200
Doc 2: Price: $350
Doc 3: Price: $150
```

**Inconsistent:**
```text
Doc 1: Price: $200
Doc 2: Price: 350 USD
Doc 3: Cost: 150 dollars
```

S-RAG can handle some variations, but consistency improves accuracy.

### 5. Include Metadata

Add context that helps extraction:

```text
Product Information:
- Product Name: Wireless Headphones XZ-100
- Category: Electronics > Audio > Headphones
- Release Date: January 2023
- Status: In Stock

Specifications:
- Battery Life: 30 hours
- Weight: 250g
- Wireless: Yes
- Noise Cancellation: Active

Pricing:
- MSRP: $149.99
- Current Price: $129.99
- Discount: 13%
```

---

## Common Patterns

### Pattern 1: Product Catalog

**Document Structure:**
- Product name
- Category
- Price
- Features (as separate attributes)
- Ratings/reviews
- Availability

**Sample Questions:**
- Average price per category
- Products with specific features
- Top-rated products
- Price ranges by category

### Pattern 2: Company Database

**Document Structure:**
- Company name
- Founded date
- Location
- Employee count
- Revenue
- Industry
- Funding status

**Sample Questions:**
- Average revenue by industry
- Companies by location
- Largest companies by employee count
- Funding raised per industry

### Pattern 3: Research Papers

**Document Structure:**
- Title
- Authors
- Publication year
- Venue/journal
- Citation count
- Keywords
- Abstract (summarized)

**Sample Questions:**
- Average citations per year
- Papers by author count
- Most cited papers in a topic
- Publication trends over time

### Pattern 4: Real Estate Listings

**Document Structure:**
- Address/location
- Price
- Bedrooms/bathrooms
- Square footage
- Year built
- Property type
- Amenities

**Sample Questions:**
- Average price per neighborhood
- Properties by size range
- Homes with specific amenities
- Price per square foot by area

### Pattern 5: Event Information

**Document Structure:**
- Event name
- Date/time
- Location
- Attendance
- Ticket price
- Event type
- Duration

**Sample Questions:**
- Average attendance by event type
- Events by location
- Ticket price ranges
- Most popular event months

---

## Troubleshooting

### Issue 1: Schema Missing Important Attributes

**Symptom:** Generated schema doesn't include attributes you need

**Solutions:**
1. Add questions that reference those attributes
2. Ensure sample documents contain those attributes
3. Use more sample documents (try 15-20 instead of 10-12)
4. Make attribute labels more explicit in documents

### Issue 2: Incorrect Data Extraction

**Symptom:** Extracted values are wrong or inconsistent

**Solutions:**
1. Use clearer labels in documents
2. Standardize formats across documents
3. Include units explicitly (e.g., "Price: $100" not "100")
4. Check for ambiguous phrasing

### Issue 3: Poor Query Results

**Symptom:** Queries return unexpected results

**Solutions:**
1. Inspect the generated schema - is it correct?
2. Check extracted records in the database
3. Verify SQL query generation (use CLI with --verbose)
4. Ensure questions match schema attributes

### Issue 4: Schema Too Generic

**Symptom:** Schema has very generic attribute names

**Solutions:**
1. Use more specific labels in documents
2. Provide domain-specific sample questions
3. Include more representative sample documents
4. Consider manually refining the schema

### Issue 5: Long Processing Time

**Symptom:** Ingestion takes very long

**Solutions:**
1. Reduce document size (aim for 200-500 words)
2. Remove redundant information
3. Use batch processing (already default)
4. Consider splitting corpus into smaller batches

---

## Examples

### Complete Example: Small Business Database

**documents.json:**
```json
[
  "Business: Coffee Corner\nType: Cafe\nLocation: Seattle, WA\nEmployees: 8\nFounded: 2018\nRevenue: $250,000\nRating: 4.3 stars\nSeating Capacity: 40\nWiFi: Yes\nParking: No",

  "Business: Tech Repair Shop\nType: Service\nLocation: Seattle, WA\nEmployees: 5\nFounded: 2020\nRevenue: $180,000\nRating: 4.7 stars\nSeating Capacity: N/A\nWiFi: Yes\nParking: Yes",

  "Business: Green Grocers\nType: Retail\nLocation: Portland, OR\nEmployees: 12\nFounded: 2015\nRevenue: $420,000\nRating: 4.1 stars\nSeating Capacity: N/A\nWiFi: No\nParking: Yes"
]
```

**questions.txt:**
```text
What is the average revenue for businesses in Seattle?
How many businesses have WiFi?
Which business has the highest rating?
What is the total number of employees across all businesses?
How many businesses were founded after 2017?
What is the average rating for businesses with parking?
Which type of business has the highest average revenue?
How many cafes are in the database?
What is the revenue range for retail businesses?
Which location has the most businesses?
```

**Usage:**
```bash
# Ingest
npm run srag ingest --docs data/businesses/documents.json \
                     --questions data/businesses/questions.txt \
                     --db data/businesses.db \
                     --table businesses

# Query
npm run srag query --question "What is the average revenue in Seattle?" \
                    --db data/businesses.db \
                    --table businesses
```

---

## Summary Checklist

Before ingesting your data, verify:

- [ ] Documents have consistent structure
- [ ] Documents contain 200-500 words each
- [ ] Documents share common attributes (schema)
- [ ] Clear attribute-value pairs in documents
- [ ] 10-15 sample questions prepared
- [ ] Questions are aggregative (count, average, filter, etc.)
- [ ] Questions reference attributes in documents
- [ ] File formats are correct (JSON or TXT)
- [ ] Sample documents are representative of full corpus
- [ ] Units and formats are consistent
- [ ] Metadata and labels are descriptive
- [ ] No sensitive/private information in sample data

---

## Next Steps

After preparing your data:

1. **Test with samples:** Run ingestion on 10-20 documents first
2. **Inspect schema:** Review the generated schema for accuracy
3. **Test queries:** Try a few sample questions
4. **Iterate:** Refine documents/questions as needed
5. **Scale up:** Ingest your full corpus
6. **Evaluate:** Run evaluation on test questions

For more information:
- [Quickstart Guide](quickstart.md) - Step-by-step tutorial
- [Architecture Documentation](architecture.md) - System design
- [Evaluation Guide](evaluation.md) - Testing your system

---

**Happy ingesting!** 🚀
