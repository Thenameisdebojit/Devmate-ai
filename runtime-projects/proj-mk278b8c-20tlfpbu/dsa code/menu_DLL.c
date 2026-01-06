#include<stdio.h>
#include<stdlib.h>
struct Node{
    int info;
    struct Node* prev;
    struct Node* next;
};
struct Node* foreward_traversal(struct Node* start){
    struct Node* ptr=start;
    if(start=NULL){
        printf("list is empty");
    }
    else{
        printf("list is:");
        while(ptr!=NULL){
            printf("%d\t",ptr->info);
            ptr=ptr->next;
        }
    }
}
struct Node* create_dll(struct Node* start){
    struct Node* new;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item:");
        scanf("%d",&item);
        new->info=item;
        new->prev=NULL;
        new->next=NULL;
        if(start==NULL){
            start=new;
        }
    }
    return start;
}
struct Node* insert_beg(struct Node* start){
    struct Node* new;
    int item;

    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to be inserted:");
        scanf("%d",&item);
        new->info=item;
        new->next=NULL;
        new->prev=NULL;
        if(start==NULL){
            start=new;
        }
        else{
            new->next=start;
            start->prev=new;
            start=new;
        }
    }
    return start;
}
struct Node* insert_end(struct Node* start){
    struct Node* new,*prev,* ptr=start;
    int item,i=1;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to be insert:");
        scanf("%d",&item);
        new->info=item;
        new->prev=NULL;
        new->next=NULL;
        if(start==NULL){
            start=new;
        }
        else{
            start=ptr;
            while(ptr->next!=NULL){
                ptr=ptr->next;
                i++;
            }
            ptr->next=new;
            new->prev=ptr;
        }
    }
    return start;
}
struct Node* insert_LOC(struct Node* start){
    struct Node* new,*ptr,*ptr1;
    int item,loc,i=1;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item and loc to be inserted...");
        scanf("%d %d",&item,&loc);
        new->info=item;
        new->next=NULL;
        new->prev=NULL;
        if(start==NULL){
            start=new;
        }
        else{
            ptr1=start;
            while(i<loc && ptr!=NULL){
                ptr=ptr1;
                ptr=ptr->next;
                i++;
            }
            if(ptr1==NULL){
                printf("location not found");
            }
            else if(ptr1==start){
                new->next=start;
                start->prev=new;
                start=new;
            }
            else{
              ptr->next=new;
              new->prev=ptr;
              new->next=ptr1;
              ptr1->prev=new;
            }
        }
    }
    return start; 
}
struct Node* delete_beg(struct Node* start){
    struct Node* ptr;
    if(start==NULL){
        printf("UNDERFLOW");
    }
    else{
        ptr=start;
        printf("Deleted item is %d",ptr->info);
        start=start->next;
        start->prev=NULL;
        free(ptr);
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
        while(ptr->next!=NULL){
            prev=ptr;
            ptr=ptr->next;
        }
        printf("deleted item is %d",ptr->info);
        prev->next=NULL;
        free(ptr);
    }
    return start;
}
int main(){
    struct Node* start=NULL;
    int option,item;
    start=create_dll(start);
    do{
        printf("\nMENU:\n1->Foreward_Traversal\n2->Insert_Beg\n3->Insert_End\n4->Insert_LOC\n5->Delete_Beg\n6->Delete_End\n7->Exit\n");
        printf("Enter your option:");
        scanf("%d",&option);
        switch(option){
            case 1:
                start=foreward_traversal(start);
                break;
            case 2:
                start=insert_beg(start);
                foreward_traversal(start);

                break;
            case 3:
                start=insert_end(start);
                foreward_traversal(start);
                break;
            case 4:
                start=insert_LOC(start);
                foreward_traversal(start);
                break;
            case 5:
                start=delete_beg(start);
                foreward_traversal(start);
                break;
            case 6:
                start=delete_end(start);
                foreward_traversal(start);
                break;
            case 7:
                printf("Exiting...");
                break;
            default:
                printf("Invalid option");
                break;
        }
    }while(option!=7);
}
