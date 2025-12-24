import asyncio
import sys
import os
import argparse

# Add parent dir to path to find 'orchestrator_service'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "orchestrator_service")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine
from app.models.chat import ChatConversation
from app.models.customer import Customer
from app.models.base import Base

async def migrate_identity(dry_run: bool = False):
    print(f"Starting Nexus Identity Migration... (Dry Run: {dry_run})")
    
    # 1. Ensure Table Exists (Customer)
    # In dry run, we still need the table to exist to query it, but we won't modify data.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Schema ensured.")

    async with AsyncSessionLocal() as session:
        # 2. Fetch Conversations without Customer
        stmt = select(ChatConversation).where(ChatConversation.customer_id == None)
        result = await session.execute(stmt)
        conversations = result.scalars().all()
        
        print(f"Found {len(conversations)} conversations pending migration.")
        
        created_count = 0
        linked_count = 0
        
        for conv in conversations:
            phone = conv.external_user_id
            tenant_id = conv.tenant_id
            
            # Normalize phone (strip +)
            cleaned_phone = "".join(filter(str.isdigit, phone))
            
            # 3. Find or Create Customer
            # Check if customer exists for this tenant/phone
            stmt_cust = select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.phone_number == cleaned_phone
            )
            res_cust = await session.execute(stmt_cust)
            customer = res_cust.scalar_one_or_none()
            
            if not customer:
                if dry_run:
                    print(f"[DRY RUN] Would create new customer for {cleaned_phone} (Tenant {tenant_id})")
                    # Mock customer for linkage logic if needed, or just skip
                    created_count += 1
                    continue
                else:
                    print(f"Creating new customer for {cleaned_phone} (Tenant {tenant_id})")
                    customer = Customer(
                        tenant_id=tenant_id,
                        phone_number=cleaned_phone,
                        first_name=conv.display_name or "Unknown"
                    )
                    session.add(customer)
                    # We need to flush to get ID for linkage, catch constraint errors
                    await session.flush() 
                    created_count += 1
            
            # 4. Link
            if dry_run:
                 print(f"[DRY RUN] Would link Conversation {conv.id} to Customer {cleaned_phone}")
                 linked_count += 1
            else:
                conv.customer_id = customer.id
                conv.external_user_id = cleaned_phone # Normalize this too
                linked_count += 1
            
        if not dry_run:
            await session.commit()
            print(f"Migration Complete. Created {created_count} customers. Linked {linked_count} conversations.")
        else:
            print(f"Dry Run Complete. Would have created {created_count} customers and linked {linked_count} conversations. No changes made.")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    parser = argparse.ArgumentParser(description="Migrate Legacy Conversations to Nexus Identity (Customer).")
    parser.add_argument("--dry-run", action="store_true", help="Simulate migration without committing changes.")
    args = parser.parse_args()
    
    asyncio.run(migrate_identity(dry_run=args.dry_run))
