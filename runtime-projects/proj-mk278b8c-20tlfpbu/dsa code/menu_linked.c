#include<stdio.h>
#include<stdlib.h>
//ADT for SLL.Self-Referential Structure.
struct node
{
	int info;
	struct node * link;
};
struct node * create_sll(struct node * start)
{
	struct node * new;
	int item;
	new=(struct node *)malloc(sizeof(struct node));
	if(new==NULL)
		printf("\nOVERFLOW\n");
	else
	{
		printf("\nEnter Item:\n");
		scanf("%d",&item);
		new->info=item;
		new->link=NULL;
		if(start==NULL)
			start = new;
	}
	return start;
}
void traversal(struct node *start)
{
	struct node * ptr = start;
	printf("\nContent of the SLL:\n");
	while(ptr!=NULL)
	{
		printf("%d\t",ptr->info);
		ptr=ptr->link;
	}
}
struct node * insert_beg(struct node * start)
{
	struct node * new;
	int item;
	new=(struct node *)malloc(sizeof(struct node));
	if(new==NULL)
		printf("\nOVERFLOW\n");
	else
	{
		printf("\nEnter Item:\n");
		scanf("%d",&item);
		new->info=item;
		new->link=NULL;
		if(start==NULL)
			start = new;
		else
		{
			new->link=start;
			start=new;
		}
	}
	return start;
}
struct node * insert_end(struct node * start)
{
	struct node * new, *ptr = start;
	int item;
	new=(struct node *)malloc(sizeof(struct node));
	if(new==NULL)
		printf("\nOVERFLOW\n");
	else
	{
		printf("\nEnter Item:\n");
		scanf("%d",&item);
		new->info=item;
		new->link=NULL;
		if(start==NULL)
			start = new;
		else
		{
			while(ptr->link!=NULL)
				ptr=ptr->link;
			ptr->link=new;
		}
	}
	return start;
}
struct node * delete_beg(struct node * start)
{
	struct node *ptr=start;
	if(start==NULL)
		printf("\nUNDERFLOW\n");
	else
	{
		printf("\nItem Deleted=%d\n",ptr->info);
		start=ptr->link;
		free(ptr);
	}
	return start;
}
struct node * delete_end(struct node * start)
{
	struct node *ptr=start,*prev=start;
	if(start==NULL)
		printf("\nUNDERFLOW\n");
	else
	{
		while(ptr->link!=NULL)
		{
			prev=ptr;
			ptr=ptr->link;
		}
		printf("\nItem Deleted=%d\n",ptr->info);
		prev->link=NULL;
		free(ptr);
	}
	return start;
}
void searching_sll(struct node * start, int item)
{
	struct node * ptr = start;
	int loc=1;
	while(ptr!=NULL && ptr->info!=item)
		{ ptr=ptr->link;loc++;}
	if(ptr==NULL)
		printf("\nUnsuccsful Search.\n");
	else
		printf("\n%d found at %d Node.\n",item,loc);
}
void sorting_sll(struct node * start)
{
	struct node * ptr1=start,*ptr2;
	int temp;
	while(ptr1->link!=NULL)
	{
		ptr2=ptr1->link;
		while(ptr2!=NULL)
		{
			if(ptr1->info>ptr2->info)
			{
				temp=ptr1->info;
				ptr1->info=ptr2->info;
				ptr2->info=temp;
			}
			ptr2=ptr2->link;
		}
		ptr1=ptr1->link;
	}
}
struct node * reversal(struct node * start)
{
	struct node *ptr=start,*prev=NULL,*temp;
	while(ptr!=NULL)
	{
		temp=ptr->link;
		ptr->link=prev;
		prev=ptr;
		ptr=temp;
	}
	start=prev;
	return start;
}
int main()
{
	struct node * start = NULL;
	int option, item;
	start=create_sll(start);
	do
	{
	printf("\nMENU:\n1.Traversal.\n2.Insert_Beg\n3.Insert_End\n");
	printf("4.Delete_Beg\n5.Delete_End.\n");
	printf("6.Searching_Sll\n7.Sorting_Sll\n8.Reverse.\n9.Exit.\n");
	printf("\nEnter Your Choice:\n");
	scanf("%d",&option);
	switch(option)
	{
		case 1:traversal(start);break;
		case 2:start=insert_beg(start);traversal(start);break;
		case 3:start=insert_end(start);traversal(start);break;
		case 4:start=delete_beg(start);traversal(start);break;
		case 5:start=delete_end(start);traversal(start);break;
		case 6: printf("\nEnter item to be searched:\n");
				scanf("%d",&item);
				searching_sll(start,item);
				break;
		case 7: printf("\nBefore Sorting:\n");
				traversal(start);
				sorting_sll(start);
				printf("\nAfter Sorting:\n");
				traversal(start);break;
		case 8: printf("\nBefore Reversal:\n");
				traversal(start);
				start=reversal(start);
				printf("\nAfter Reversal:\n");
				traversal(start);break;
		case 9: exit(0);
	}
	}while(option<10);
	return 0;
}

