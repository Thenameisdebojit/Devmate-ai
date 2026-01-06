#include<stdio.h>
#include<stdlib.h>
struct Node{
    int info;
    struct Node*link;
};
struct Node*  create_csll(struct Node* start){
    struct Node* new;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
    printf("enter item to start ...");
    scanf("%d",&item);
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        new->info=item;
        new->link=start;
        start=new;
    }
    return start;
}
struct Node* insert_beg(struct Node* start){
    struct Node* new,*ptr;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
   
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to be inserted");
        scanf("%d",&item);
        new->info=item;
        new->link=NULL;
        if(start==NULL){
            start=new;
            new->link=start;
        }
        else{
            for(ptr=start;ptr->link!=start;ptr=ptr->link){
                ptr->link=new;
                new->link=start;
                start=new;
            }
        }
    }
   
    return start;
}
struct Node*  insert_end(struct Node* start){
    struct Node* ptr,*new;
    int item;
    new=(struct Node *)malloc(sizeof(struct Node));
    
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to be inserted");
        scanf("%d",&item);
        new->info=item;
        new->link=NULL;
        if(start==NULL){
            start=new;
            new->link=start;
        }
        else{
            while(ptr->link!=start){
                ptr=ptr->link;
            }
            ptr->link=new;
            new->link=start;
        }
      
    }
    
    return start;
}
struct Node* delete_beg(struct Node* start){
    struct Node* ptr;
     if(start==NULL){
        printf("UNDERflow");
     }
     else{
        ptr=start;
        while(ptr->link!=NULL){
            ptr=ptr->link;


        }
        ptr->link=start->link;
        ptr=start;
        printf("deleted item is %d",ptr->info);
      
     }
        
        return start;
}
struct Node* delete_end(struct Node* start){
    struct Node* ptr,*prev;
    if(start==NULL){
        printf("UNDERFLOW");
    }
    else{
        ptr=start;
        while(ptr->link!=start){
            prev=ptr;
            ptr=ptr->link;
        }
        prev->link=start;
        printf("deleted items are %d",ptr->info);
        free(ptr);
      


    }
    return start;
}
void traverse(struct Node *start)
{
    struct Node * ptr = start;
    if(start==NULL)
        printf("\nEmpty CSLL.\n");
    else
    {
        printf("\nContent of CSLL:\n");
        printf("%d\t",ptr->info);//Print 1st node information.
        ptr=ptr->link;
        while(ptr!=start)
        {
            printf("%d\t",ptr->info);
            ptr=ptr->link;
        }
    }
}
int main(){
    struct Node* start=NULL;
    int item,choice;
    start=create_csll(start);
    do{
        printf("\n MENU\n1.insert at beg\n2.insert at end\n3.delete at beg\n4.delete at end\n5.traverse\n6.exit\n");
        printf("enter your choice");
        scanf("%d",&choice);
        switch(choice){

            case 1:
                start=insert_beg(start);
                traverse(start);
                break;
            case 2:
                start=insert_end(start);
                traverse(start);
                break;
            case 3:
                start=delete_beg(start);
                traverse(start);
                break;
            case 4:
                start=delete_end(start);
                traverse(start);
                break;
            case 5:
                traverse(start);
                break;
            case 6:
                exit(0);
                break;
            default:
                printf("invalid choice");
        }
    }while(choice!=7);
}
